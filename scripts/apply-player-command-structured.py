from pathlib import Path

workspace_definition_path = Path("src/author/ui/workspaceDefinition.tsx")
workspace_definition = workspace_definition_path.read_text()

old_context = '''export type AuthorWorkspaceBuildContext<TDraft> = {
  route: AuthorFeatureTaskRoute;
  context: AuthorWorkspaceContext;
  draft: TDraft;
  setDraft: Dispatch<SetStateAction<TDraft>>;
};
'''
new_context = '''export type AuthorWorkspaceSaveOptions = {
  /** Suppress nested resource-task completion when saving only to establish a child editor prerequisite. */
  completeTask?: boolean;
};

export type AuthorWorkspaceBuildContext<TDraft> = {
  route: AuthorFeatureTaskRoute;
  context: AuthorWorkspaceContext;
  draft: TDraft;
  setDraft: Dispatch<SetStateAction<TDraft>>;
  /** Shared task save boundary. Feature actions may save before nesting without creating another persistence path. */
  saveCurrentDraft?: (options?: AuthorWorkspaceSaveOptions) => Promise<boolean>;
};
'''
if workspace_definition.count(old_context) != 1:
    raise SystemExit("Expected one AuthorWorkspaceBuildContext definition")
workspace_definition = workspace_definition.replace(old_context, new_context)

old_build = '''  const build = useMemo<AuthorWorkspaceBuildContext<TDraft>>(
    () => ({ route, context, draft, setDraft }),
    [context, draft, route],
  );
  const validForSave = definition.canSave?.(build) ?? true;

  const save = useCallback(async () => {
    if (!definition.save || !validForSave) return false;
    const result = await definition.save(build);
    if (!result.accepted) return false;
    const savedDraft = result.draft ?? build.draft;
    if (result.draft !== undefined) setDraft(savedDraft);
    setBaseline(signature(savedDraft));
    context.setWorkspaceDirty(false);
    if (result.completion && context.hasParentTask) context.completeTask(result.completion);
    return true;
  }, [build, context, definition, signature, validForSave]);
'''
new_build = '''  const saveBuild = useMemo<AuthorWorkspaceBuildContext<TDraft>>(
    () => ({ route, context, draft, setDraft }),
    [context, draft, route],
  );
  const validForSave = definition.canSave?.(saveBuild) ?? true;

  const save = useCallback(async (options: AuthorWorkspaceSaveOptions = {}) => {
    if (!definition.save || !validForSave) return false;
    const result = await definition.save(saveBuild);
    if (!result.accepted) return false;
    const savedDraft = result.draft ?? saveBuild.draft;
    if (result.draft !== undefined) setDraft(savedDraft);
    setBaseline(signature(savedDraft));
    context.setWorkspaceDirty(false);
    if (result.completion && options.completeTask !== false && context.hasParentTask) context.completeTask(result.completion);
    return true;
  }, [context, definition, saveBuild, signature, validForSave]);

  const build = useMemo<AuthorWorkspaceBuildContext<TDraft>>(
    () => ({ ...saveBuild, saveCurrentDraft: save }),
    [save, saveBuild],
  );
'''
if workspace_definition.count(old_build) != 1:
    raise SystemExit("Expected one structured workspace build/save block")
workspace_definition = workspace_definition.replace(old_build, new_build)

old_register = '''    context.registerWorkspaceSave(save);
    return () => context.registerWorkspaceSave(null);
  }, [context.registerWorkspaceSave, definition.save, save]);
'''
new_register = '''    context.registerWorkspaceSave(() => save());
    return () => context.registerWorkspaceSave(null);
  }, [context.registerWorkspaceSave, definition.save, save]);
'''
if workspace_definition.count(old_register) != 1:
    raise SystemExit("Expected structured workspace save registration")
workspace_definition = workspace_definition.replace(old_register, new_register)
workspace_definition_path.write_text(workspace_definition)

command_workspace_path = Path("src/features/commands/author/commandWorkspace.tsx")
command_workspace_path.write_text(r'''import type { AuthorUiAction, AuthorUiNode } from "../../../author/ui/types";
import { defineAuthorWorkspace, type AuthorWorkspaceBuildContext } from "../../../author/ui/workspaceDefinition";
import { OutcomeEffectsEditor } from "../../../author/outcomes/OutcomeComposer";
import { APPLICATION_COMMAND_CAPABILITIES } from "../../../engine/application/catalog";
import { normalizePlayerInput } from "../../../engine/input/normalize";
import { SEMANTIC_REFERENCE_PROVIDERS, semanticReferenceProvider } from "../../../engine/references/catalog";
import { AuthoredTextEditor } from "../../narrative/author/AuthoredTextEditor";
import type { CommandAction, CommandDefinition, CommandProjectSettings, CommandSlotDefinition } from "../model";
import { persistCommands, referenceSetting, updateReferenceSetting } from "./settingsPersistence";

const OPERATION_ID_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const PLACEHOLDER_PATTERN = /\{([a-z][a-z0-9_-]*)\}/gi;
const RESPONSE_ACTION = "__response__";
const TARGET_ACTION = "__target__";

type CommandWorkspaceDraft = {
  command: CommandDefinition;
  patternsText: string;
  saving: boolean;
  saveError: string;
  confirmDelete: boolean;
};

function patternLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function placeholderNames(patterns: string[]) {
  const seen = new Set<string>();
  for (const pattern of patterns) {
    for (const match of pattern.matchAll(PLACEHOLDER_PATTERN)) seen.add(match[1].toLowerCase());
  }
  return [...seen];
}

function patternHasSlot(pattern: string, slotName: string) {
  return placeholderNames([pattern]).includes(slotName.toLowerCase());
}

function targetProviders() {
  return SEMANTIC_REFERENCE_PROVIDERS.filter((provider) => provider.targetable);
}

function defaultResponseAction(): CommandAction {
  return {
    type: "response",
    responseText: "",
    responsePerformance: { charactersPerSecond: 18, cues: [] },
    speakerId: null,
    effects: [],
  };
}

function actionChoice(action: CommandAction) {
  if (action.type === "response") return RESPONSE_ACTION;
  if (action.type === "target-operation") return TARGET_ACTION;
  return `application:${action.operation}`;
}

function patternsFor(draft: CommandWorkspaceDraft) {
  return patternLines(draft.patternsText);
}

function slotsFor(draft: CommandWorkspaceDraft): CommandSlotDefinition[] {
  const names = placeholderNames(patternsFor(draft));
  return names.map((name) => draft.command.slots.find((slot) => slot.name === name) ?? { name, sourceKinds: [] });
}

function commandForSave(draft: CommandWorkspaceDraft): CommandDefinition {
  return {
    ...draft.command,
    label: draft.command.label.trim(),
    patterns: patternsFor(draft),
    slots: slotsFor(draft),
  };
}

function commandProblem(draft: CommandWorkspaceDraft) {
  const command = draft.command;
  const patterns = patternsFor(draft);
  const slots = slotsFor(draft);
  const targetAction = command.action.type === "target-operation" ? command.action : null;
  const targetSlot = targetAction ? slots.find((slot) => slot.name === targetAction.targetSlot) : undefined;
  const targetPatternsWithoutSlot = targetAction?.targetSlot
    ? patterns.filter((pattern) => !patternHasSlot(pattern, targetAction.targetSlot))
    : [];

  if (!command.label.trim()) return "Give this command a name.";
  if (!patterns.length) return "Add at least one real player input.";
  if (targetAction && !OPERATION_ID_PATTERN.test(targetAction.operation)) return "Target operations need a valid operation id.";
  if (targetAction && !targetAction.targetSlot) return "Choose which player-supplied value is the target.";
  if (targetAction && !targetSlot?.sourceKinds.length) return `Choose what {${targetAction.targetSlot}} can name.`;
  if (targetAction && targetPatternsWithoutSlot.length) {
    return `Every input for this target operation must include {${targetAction.targetSlot}}. Put targetless wording in a separate Player Command.`;
  }
  return "";
}

function commandSignature(draft: CommandWorkspaceDraft) {
  return JSON.stringify({
    ...draft.command,
    patterns: patternsFor(draft),
    slots: slotsFor(draft),
  });
}

function persistableCommands(
  context: AuthorWorkspaceBuildContext<CommandWorkspaceDraft>["context"],
  command: CommandDefinition,
) {
  let commands: CommandProjectSettings = {
    ...context.snapshot.settings.commands,
    commands: context.snapshot.settings.commands.commands.some((candidate) => candidate.id === command.id)
      ? context.snapshot.settings.commands.commands.map((candidate) => candidate.id === command.id ? command : candidate)
      : [...context.snapshot.settings.commands.commands, command],
  };
  for (const kind of new Set(command.slots.flatMap((slot) => slot.sourceKinds))) {
    const setting = referenceSetting(commands, kind);
    commands = updateReferenceSetting(commands, { ...setting, enabled: true });
  }
  return commands;
}

export const commandWorkspace = defineAuthorWorkspace<CommandWorkspaceDraft>({
  id: "commands-command",
  matches: (route) => route.type === "feature" && route.feature === "commands" && route.workspace === "command",
  createDraft: (route, context) => {
    const commandId = route.data?.commandId ?? "new";
    const initialOperation = route.data?.operation ?? "";
    const existing = context.snapshot.settings.commands.commands.find((command) => command.id === commandId);
    const command: CommandDefinition = structuredClone(existing ?? {
      id: crypto.randomUUID(),
      label: "",
      enabled: true,
      patterns: [],
      slots: [],
      action: initialOperation
        ? { type: "target-operation", operation: initialOperation, targetSlot: "" }
        : defaultResponseAction(),
    });
    return {
      command,
      patternsText: command.patterns.join("\n"),
      saving: false,
      saveError: "",
      confirmDelete: false,
    };
  },
  signature: commandSignature,
  canSave: ({ draft }) => !draft.saving && !commandProblem(draft),
  save: async ({ route, context, draft, setDraft }) => {
    const problem = commandProblem(draft);
    if (problem) {
      setDraft((current) => ({ ...current, saveError: problem }));
      return { accepted: false };
    }

    const command = commandForSave(draft);
    const persisted = context.snapshot.settings.commands.commands.find((candidate) => candidate.id === command.id);
    setDraft((current) => ({ ...current, saving: true, saveError: "" }));
    const result = await persistCommands(
      context,
      persistableCommands(context, command),
      `${persisted ? "Changed" : "Created"} command ${command.label}`,
    );
    if (result.status !== "saved" && result.status !== "queued") {
      setDraft((current) => ({
        ...current,
        saving: false,
        saveError: result.status === "conflict"
          ? "The project changed while this command was saving. Your draft is still here; save it again."
          : result.message ?? "This command could not be saved. Your draft is still here.",
      }));
      return { accepted: false };
    }

    const savedDraft: CommandWorkspaceDraft = {
      command,
      patternsText: command.patterns.join("\n"),
      saving: false,
      saveError: "",
      confirmDelete: false,
    };
    return {
      accepted: true,
      draft: savedDraft,
      ...(route.data?.resourceTask === "player-command" ? {
        completion: {
          type: "resource" as const,
          kind: "player-command",
          id: command.id,
          value: command.id,
          label: command.label,
        },
      } : {}),
    };
  },
  buildSpec: ({ context, draft, setDraft, saveCurrentDraft }) => {
    const command = draft.command;
    const patterns = patternsFor(draft);
    const slotNames = placeholderNames(patterns);
    const slots = slotsFor(draft);
    const persisted = context.snapshot.settings.commands.commands.find((candidate) => candidate.id === command.id);
    const providers = targetProviders();
    const targetAction = command.action.type === "target-operation" ? command.action : null;
    const targetActionKinds = targetAction
      ? slots.find((slot) => slot.name === targetAction.targetSlot)?.sourceKinds ?? []
      : [];
    const targetOperation = targetAction?.operation ?? "";
    const problem = commandProblem(draft);
    const showProblem = Boolean(problem && (command.label.trim() || draft.patternsText.trim() || command.action.type !== "response"));

    const change = (update: (current: CommandWorkspaceDraft) => CommandWorkspaceDraft) => {
      setDraft((current) => ({ ...update(current), saveError: "" }));
    };

    const setSlotKinds = (name: string, sourceKinds: string[]) => change((current) => {
      const names = placeholderNames(patternLines(current.patternsText));
      const nextSlots = names.map((slotName) => slotName === name
        ? { name, sourceKinds }
        : current.command.slots.find((slot) => slot.name === slotName) ?? { name: slotName, sourceKinds: [] });
      const action = current.command.action.type === "target-operation" && sourceKinds.length && !current.command.action.targetSlot
        ? { ...current.command.action, targetSlot: name }
        : current.command.action;
      return { ...current, command: { ...current.command, slots: nextSlots, action } };
    });

    const configureTarget = (sourceKind: string) => change((current) => {
      const currentPatterns = patternLines(current.patternsText);
      const currentNames = placeholderNames(currentPatterns);
      const currentSlots = currentNames.map((name) => current.command.slots.find((slot) => slot.name === name) ?? { name, sourceKinds: [] });
      const action = current.command.action.type === "target-operation" ? current.command.action : null;
      const operation = action?.operation ?? "inspect";
      const slotName = action?.targetSlot || currentSlots[0]?.name || "target";
      const verb = normalizePlayerInput(current.command.label || operation || "inspect") || "inspect";
      const nextPatterns = currentNames.includes(slotName) ? currentPatterns : [...currentPatterns, `${verb} {${slotName}}`];
      const nextNames = placeholderNames(nextPatterns);
      const nextSlots = nextNames.map((name) => {
        const existingSlot = current.command.slots.find((slot) => slot.name === name) ?? { name, sourceKinds: [] };
        if (name !== slotName) return existingSlot;
        return {
          ...existingSlot,
          sourceKinds: existingSlot.sourceKinds.includes(sourceKind)
            ? existingSlot.sourceKinds
            : [...existingSlot.sourceKinds, sourceKind],
        };
      });
      return {
        ...current,
        patternsText: nextPatterns.join("\n"),
        command: {
          ...current.command,
          label: current.command.label.trim() ? current.command.label : operation,
          slots: nextSlots,
          action: action ? { ...action, targetSlot: slotName } : current.command.action,
        },
      };
    });

    const chooseAction = (value: string) => change((current) => {
      if (value === RESPONSE_ACTION) {
        return {
          ...current,
          command: {
            ...current.command,
            action: current.command.action.type === "response" ? current.command.action : defaultResponseAction(),
          },
        };
      }
      if (value === TARGET_ACTION) {
        const currentSlots = slotsFor(current);
        return {
          ...current,
          command: {
            ...current.command,
            action: current.command.action.type === "target-operation"
              ? current.command.action
              : {
                type: "target-operation",
                operation: "inspect",
                targetSlot: currentSlots.find((slot) => slot.sourceKinds.length)?.name ?? currentSlots[0]?.name ?? "",
              },
          },
        };
      }
      return {
        ...current,
        command: {
          ...current.command,
          action: { type: "application", operation: value.replace(/^application:/, "") },
        },
      };
    });

    const openTargetBehaviors = async (sourceKind: string) => {
      if (draft.saving || !targetAction) return;
      const normalized = commandForSave(draft);
      const saved = context.snapshot.settings.commands.commands.find((candidate) => candidate.id === normalized.id);
      const needsSave = !saved || JSON.stringify(saved) !== JSON.stringify(normalized);
      if (needsSave) {
        if (!saveCurrentDraft || !await saveCurrentDraft({ completeTask: false })) return;
      }
      context.pushTask({
        type: "feature",
        feature: "commands",
        workspace: "target-behaviors",
        data: { sourceKind, operation: targetAction.operation, commandLabel: normalized.label },
      });
    };

    const remove = async () => {
      if (!persisted || draft.saving) return;
      setDraft((current) => ({ ...current, saving: true, saveError: "" }));
      const commands = {
        ...context.snapshot.settings.commands,
        commands: context.snapshot.settings.commands.commands.filter((candidate) => candidate.id !== persisted.id),
      };
      const result = await persistCommands(context, commands, `Deleted command ${persisted.label}`);
      if (result.status === "saved" || result.status === "queued") {
        context.leaveCurrentTask();
        return;
      }
      setDraft((current) => ({
        ...current,
        saving: false,
        saveError: result.status === "conflict"
          ? "The project changed while this command was being deleted. Try again."
          : result.message ?? "This command could not be deleted.",
      }));
    };

    const blocks: AuthorUiNode[] = [
      {
        type: "toggle",
        id: "command-enabled",
        label: "Enabled",
        checked: command.enabled,
        onChange: (enabled) => change((current) => ({ ...current, command: { ...current.command, enabled } })),
      },
      {
        type: "field",
        id: "command-label",
        label: "Name",
        value: command.label,
        placeholder: "Command name",
        help: "Author-facing name used to find this command.",
        onChange: (label) => change((current) => ({ ...current, command: { ...current.command, label } })),
      },
      {
        type: "field",
        id: "command-patterns",
        label: "Player inputs",
        control: "textarea",
        rows: 4,
        value: draft.patternsText,
        placeholder: "one accepted player input per line",
        help: "Use {name} anywhere a player-supplied value belongs; each brace name creates a separate value.",
        onChange: (patternsText) => change((current) => ({ ...current, patternsText })),
      },
    ];

    if (slots.length) {
      const slotChildren: AuthorUiNode[] = slots.map((slot) => {
        const children: AuthorUiNode[] = [
          {
            type: "toggle",
            id: `command-slot-free:${slot.name}`,
            label: "Free text",
            checked: !slot.sourceKinds.length,
            onChange: () => setSlotKinds(slot.name, []),
          },
          ...providers.map((provider) => ({
            type: "toggle" as const,
            id: `command-slot-source:${slot.name}:${provider.kind}`,
            label: provider.label,
            checked: slot.sourceKinds.includes(provider.kind),
            onChange: (checked: boolean) => setSlotKinds(
              slot.name,
              checked
                ? [...slot.sourceKinds, provider.kind]
                : slot.sourceKinds.filter((kind) => kind !== provider.kind),
            ),
          })),
        ];
        const openActions = providers
          .filter((provider) => provider.authorResourceKind && context.resources.canOpenList(provider.authorResourceKind))
          .map((provider) => ({
            id: `command-slot-open:${slot.name}:${provider.kind}`,
            label: `OPEN ${provider.label.toUpperCase()}`,
            onAction: () => context.resources.openList(provider.authorResourceKind!),
          }));
        if (openActions.length) children.push({ type: "action-row", id: `command-slot-open:${slot.name}`, actions: openActions });
        for (const kind of slot.sourceKinds) {
          const provider = semanticReferenceProvider(kind);
          if (provider?.targetAvailabilityDescription) {
            children.push({
              type: "status",
              id: `command-slot-availability:${slot.name}:${kind}`,
              text: `PLAY-TIME AVAILABILITY · ${provider.targetAvailabilityDescription}`,
            });
          }
        }
        return {
          type: "section" as const,
          id: `command-slot:${slot.name}`,
          label: `{${slot.name}}`,
          summary: "What can this player-supplied value name?",
          children,
        };
      });
      blocks.push({
        type: "section",
        id: "command-slots",
        label: "Player-supplied values",
        children: slotChildren,
      });
    }

    blocks.push({
      type: "select",
      id: "command-action",
      label: "Action",
      value: actionChoice(command.action),
      onChange: chooseAction,
      options: [
        { value: RESPONSE_ACTION, label: "RESPOND WITH TEXT" },
        { value: TARGET_ACTION, label: "TARGET OPERATION" },
        ...APPLICATION_COMMAND_CAPABILITIES.map((capability) => ({
          value: `application:${capability.operation}`,
          label: capability.label.toUpperCase(),
        })),
      ],
    });

    if (command.action.type === "response") {
      blocks.push({
        type: "section",
        id: "command-response",
        label: "Response",
        importance: "primary",
        children: [
          {
            type: "resource",
            id: "command-response-speaker",
            label: "Speaker",
            kind: "character",
            value: command.action.speakerId ?? "",
            allowEmpty: true,
            placeholder: "none / narration",
            onChange: (speakerId) => change((current) => current.command.action.type === "response" ? {
              ...current,
              command: {
                ...current.command,
                action: { ...current.command.action, speakerId: speakerId || null },
              },
            } : current),
          },
          {
            type: "custom",
            id: "command-response-text",
            role: "specialized-control",
            content: <AuthoredTextEditor
              value={{ text: command.action.responseText, performance: command.action.responsePerformance }}
              snapshot={context.snapshot}
              playState={context.playState}
              label="RESPONSE TEXT"
              rows={5}
              onChange={(value) => change((current) => current.command.action.type === "response" ? {
                ...current,
                command: {
                  ...current.command,
                  action: {
                    ...current.command.action,
                    responseText: value.text,
                    responsePerformance: value.performance,
                  },
                },
              } : current)}
              onPreview={(value) => context.runtime.preview({
                text: value.text,
                performance: value.performance,
                speakerId: command.action.type === "response" ? command.action.speakerId : null,
              })}
            />,
          },
          {
            type: "custom",
            id: "command-response-effects",
            role: "rule-editor",
            content: <OutcomeEffectsEditor
              effects={command.action.effects}
              snapshot={context.snapshot}
              onChange={(effects) => change((current) => current.command.action.type === "response" ? {
                ...current,
                command: {
                  ...current.command,
                  action: { ...current.command.action, effects },
                },
              } : current)}
            />,
          },
        ],
      });
    }

    if (command.action.type === "target-operation") {
      const targetChildren: AuthorUiNode[] = [
        {
          type: "field",
          id: "command-target-operation",
          label: "Operation id",
          value: command.action.operation,
          placeholder: "inspect",
          help: "Stable behavior id; player wording belongs in Player inputs.",
          onChange: (operation) => change((current) => current.command.action.type === "target-operation" ? {
            ...current,
            command: {
              ...current.command,
              action: { ...current.command.action, operation },
            },
          } : current),
        },
      ];
      if (!targetActionKinds.length) {
        targetChildren.push({
          type: "action-row",
          id: "command-target-types",
          actions: providers.map((provider) => ({
            id: `command-target-type:${provider.kind}`,
            label: `TARGET ${provider.label.toUpperCase()}`,
            onAction: () => configureTarget(provider.kind),
          })),
        });
      }
      targetChildren.push({
        type: "select",
        id: "command-target-slot",
        label: "Target input",
        value: command.action.targetSlot,
        onChange: (targetSlot) => change((current) => current.command.action.type === "target-operation" ? {
          ...current,
          command: {
            ...current.command,
            action: { ...current.command.action, targetSlot },
          },
        } : current),
        options: [
          { value: "", label: "CHOOSE…" },
          ...slots.map((slot) => ({
            value: slot.name,
            label: `{${slot.name}}${slot.sourceKinds.length
              ? ` · ${slot.sourceKinds.map((kind) => semanticReferenceProvider(kind)?.label ?? kind).join(" + ")}`
              : " · choose target type"}`,
          })),
        ],
      });
      if (targetActionKinds.length) {
        targetChildren.push({
          type: "status",
          id: "command-target-owner-note",
          text: "Optional · edit each target's behavior in the target owner's canonical Author task.",
        });
        targetChildren.push({
          type: "action-row",
          id: "command-target-owner-actions",
          actions: targetActionKinds.map((kind) => {
            const provider = semanticReferenceProvider(kind);
            const ownerLabel = (provider?.authorSyntax ?? provider?.label ?? kind).toUpperCase();
            return {
              id: `command-target-owner:${kind}`,
              label: `EDIT ${ownerLabel} ${targetOperation.toUpperCase()} BEHAVIOR`,
              disabled: draft.saving,
              onAction: () => { void openTargetBehaviors(kind); },
            };
          }),
        });
      }
      blocks.push({
        type: "section",
        id: "command-target",
        label: "Target operation",
        importance: "primary",
        children: targetChildren,
      });
    }

    if (draft.saveError) {
      blocks.push({ type: "status", id: "command-save-error", tone: "error", text: draft.saveError });
    } else if (showProblem) {
      blocks.push({ type: "status", id: "command-problem", tone: "warning", text: problem });
    }

    const actions: AuthorUiAction[] = [];
    if (persisted) {
      if (draft.confirmDelete) {
        actions.push({ id: "command-confirm-delete", label: "CONFIRM DELETE", tone: "danger", disabled: draft.saving, onAction: () => { void remove(); } });
        actions.push({ id: "command-keep", label: "KEEP", onAction: () => setDraft((current) => ({ ...current, confirmDelete: false })) });
      } else {
        actions.push({ id: "command-delete", label: "DELETE", tone: "danger", disabled: draft.saving, onAction: () => setDraft((current) => ({ ...current, confirmDelete: true })) });
      }
    }

    return {
      id: "commands-command",
      title: `Player command · ${command.label || "New"}`,
      context: patterns[0] || "No player input yet",
      blocks,
      actions,
    };
  },
});
''')

structured_path = Path("src/features/commands/author/structuredWorkspaces.ts")
structured = structured_path.read_text()
old_import = 'import { persistCommands, referenceSetting, updateReferenceSetting } from "./settingsPersistence";\n'
new_import = old_import + 'import { commandWorkspace } from "./commandWorkspace";\n'
if structured.count(old_import) != 1:
    raise SystemExit("Expected one Commands settings persistence import")
structured = structured.replace(old_import, new_import)
old_array = '''export const COMMAND_STRUCTURED_WORKSPACES = [
  commandInteractionsWorkspace,
'''
new_array = '''export const COMMAND_STRUCTURED_WORKSPACES = [
  commandWorkspace,
  commandInteractionsWorkspace,
'''
if structured.count(old_array) != 1:
    raise SystemExit("Expected Commands structured workspace registry")
structured = structured.replace(old_array, new_array)
structured_path.write_text(structured)

settings_path = Path("src/features/commands/author/CommandSettings.tsx")
settings_path.write_text('''import type { AuthorProjectSettingsSection, AuthorWorkspaceContext } from "../../../author/features/types";\nimport { SEMANTIC_REFERENCE_PROVIDERS } from "../../../engine/references/catalog";\nimport "./commandSettings.css";\n\nfunction targetProviders() {\n  return SEMANTIC_REFERENCE_PROVIDERS.filter((provider) => provider.targetable);\n}\n\nfunction CommandsOverview({ context }: { context: AuthorWorkspaceContext }) {\n  const enabledSources = context.snapshot.settings.commands.referenceSources.filter((source) => source.enabled).length;\n  const enabledCommands = context.snapshot.settings.commands.commands.filter((command) => command.enabled).length;\n  return <div className="command-settings-overview">\n    <button type="button" className="command-settings-create" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" } })}>[+ NEW PLAYER COMMAND]</button>\n    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" })}>\n      <span><strong>PLAYER COMMANDS</strong><small>Project-wide player inputs and what they do.</small></span><span>{enabledCommands} ›</span>\n    </button>\n    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "references" })}>\n      <span><strong>TARGET NAMES + ALIASES</strong><small>Player vocabulary supplied by semantic target owners.</small></span><span>{enabledSources}/{targetProviders().length} ›</span>\n    </button>\n  </div>;\n}\n\nexport const COMMAND_PROJECT_SETTINGS_SECTION: readonly AuthorProjectSettingsSection[] = [{\n  id: "commands",\n  label: "PLAYER LANGUAGE",\n  description: "Player commands and target names.",\n  order: 20,\n  render: (context) => <CommandsOverview context={context} />,\n}];\n''')

css_path = Path("src/features/commands/author/commandSettings.css")
css_path.write_text('''.command-settings-overview {\n  width: 100%;\n  max-width: 100%;\n  min-width: 0;\n  display: grid;\n  align-content: start;\n  gap: .75rem;\n  overflow-wrap: anywhere;\n}\n\n.command-settings-overview > button {\n  width: 100%;\n  min-height: 4.5rem;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 1rem;\n  padding: .8rem .9rem;\n  min-width: 0;\n  max-width: 100%;\n  border: 1px solid var(--dos-line);\n  background: transparent;\n  color: inherit;\n  text-align: left;\n}\n\n.command-settings-overview > button span:first-child {\n  flex: 1 1 auto;\n  min-width: 0;\n  display: grid;\n  gap: .25rem;\n}\n\n.command-settings-overview small {\n  color: var(--dos-muted);\n  white-space: normal;\n  line-height: 1.35;\n  overflow-wrap: anywhere;\n}\n\n.command-settings-overview > button > span:last-child {\n  flex: 0 0 auto;\n}\n\n.command-settings-create {\n  justify-content: flex-start !important;\n  min-height: 2.75rem !important;\n  color: var(--dos-bright) !important;\n}\n\n@media (max-width: 560px) {\n  .command-settings-overview > button {\n    min-height: 4.8rem;\n    align-items: flex-start;\n    flex-wrap: wrap;\n    gap: .45rem;\n  }\n\n  .command-settings-overview > button > span:last-child {\n    margin-left: auto;\n  }\n}\n''')

manifest_path = Path("src/features/commands/author/manifest.tsx")
manifest = manifest_path.read_text()
old_manifest_import = '''import {
  COMMAND_PROJECT_SETTINGS_SECTION,
  renderCommandSettingsWorkspace,
} from "./CommandSettings";
'''
new_manifest_import = 'import { COMMAND_PROJECT_SETTINGS_SECTION } from "./CommandSettings";\n'
if manifest.count(old_manifest_import) != 1:
    raise SystemExit("Expected Commands legacy renderer import")
manifest = manifest.replace(old_manifest_import, new_manifest_import)
old_render = '  renderWorkspace: renderCommandSettingsWorkspace,\n'
if manifest.count(old_render) != 1:
    raise SystemExit("Expected Commands renderWorkspace contribution")
manifest = manifest.replace(old_render, '')
manifest_path.write_text(manifest)

registry_path = Path("src/author/features/registry.tsx")
registry = registry_path.read_text()
old_commands_legacy = '  "media",\n  "commands",\n]);\n'
new_commands_legacy = '  "media",\n]);\n'
if registry.count(old_commands_legacy) != 1:
    raise SystemExit("Expected Commands in legacy Author exception list")
registry = registry.replace(old_commands_legacy, new_commands_legacy)
registry_path.write_text(registry)

print("Player Command structured migration staged successfully")
