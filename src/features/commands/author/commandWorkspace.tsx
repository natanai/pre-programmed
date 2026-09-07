import type { AuthorUiAction, AuthorUiNode } from "../../../author/ui/types";
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
