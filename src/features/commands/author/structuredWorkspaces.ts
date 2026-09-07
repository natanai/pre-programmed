import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { SEMANTIC_REFERENCE_PROVIDERS, semanticReferenceProvider } from "../../../engine/references/catalog";
import { persistCommands, referenceSetting, updateReferenceSetting } from "./settingsPersistence";
import { commandWorkspace } from "./commandWorkspace";

function targetProviders() {
  return SEMANTIC_REFERENCE_PROVIDERS.filter((provider) => provider.targetable);
}

function aliasLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

export const commandInteractionsWorkspace = defineAuthorWorkspace({
  id: "commands-interactions",
  matches: (route) => route.type === "feature" && route.feature === "commands" && route.workspace === "interactions",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "commands-interactions",
    title: "Player interactions",
    context: "Project-wide",
    blocks: [
      {
        type: "section",
        id: "commands-interactions-commands",
        label: "Player commands",
        importance: "primary",
        children: [{
          type: "action-row",
          id: "commands-interactions-open-commands",
          actions: [{
            id: "commands-interactions-open-command-list",
            label: `PLAYER COMMANDS · ${context.snapshot.settings.commands.commands.length}`,
            onAction: () => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" }),
          }],
        }],
      },
      {
        type: "section",
        id: "commands-interactions-targets",
        label: "Target owners",
        children: [{
          type: "action-row",
          id: "commands-interactions-target-actions",
          actions: targetProviders().map((provider) => ({
            id: `commands-interactions-target:${provider.kind}`,
            label: provider.label.toUpperCase(),
            disabled: !provider.authorResourceKind || !context.resources.canOpenList(provider.authorResourceKind),
            onAction: () => {
              if (provider.authorResourceKind) context.resources.openList(provider.authorResourceKind);
            },
          })),
        }],
      },
    ],
  }),
});

export const commandGrammarWorkspace = defineAuthorWorkspace({
  id: "commands-grammar",
  matches: (route) => route.type === "feature" && route.feature === "commands" && (route.workspace === "grammar" || route.workspace === "capabilities"),
  createDraft: () => ({}),
  buildSpec: ({ context }) => {
    const commands = context.snapshot.settings.commands.commands;
    return {
      id: "commands-grammar",
      title: "Player commands",
      context: `${commands.length} command${commands.length === 1 ? "" : "s"}`,
      blocks: [
        ...(commands.length ? [{
          type: "action-row" as const,
          id: "commands-grammar-list",
          actions: commands.map((command) => ({
            id: `commands-grammar:${command.id}`,
            label: `${command.label || "UNTITLED"} · ${command.enabled ? "ON" : "OFF"} · ${command.patterns[0] || "NO INPUT"}`,
            onAction: () => context.pushTask({
              type: "feature",
              feature: "commands",
              workspace: "command",
              data: { commandId: command.id },
            }),
          })),
        }] : [{
          type: "status" as const,
          id: "commands-grammar-empty",
          text: "NO PLAYER COMMANDS.",
        }]),
      ],
      actions: [{
        id: "commands-grammar-create",
        label: "+ PLAYER COMMAND",
        onAction: () => context.pushTask({ type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" } }),
      }],
    };
  },
});

export const commandReferenceSourcesWorkspace = defineAuthorWorkspace({
  id: "commands-reference-sources",
  matches: (route) => route.type === "feature" && route.feature === "commands" && route.workspace === "references",
  createDraft: () => ({}),
  buildSpec: ({ context }) => {
    const providers = targetProviders();
    const configured = context.snapshot.settings.commands.referenceSources;
    return {
      id: "commands-reference-sources",
      title: "Target names + aliases",
      context: `${configured.filter((source) => source.enabled).length} enabled`,
      blocks: [{
        type: "section",
        id: "commands-reference-source-list",
        label: "Target types",
        importance: "primary",
        children: [{
          type: "action-row",
          id: "commands-reference-source-actions",
          actions: providers.map((provider) => {
            const setting = configured.find((candidate) => candidate.sourceKind === provider.kind);
            const count = provider.candidates({ snapshot: context.snapshot, state: context.playState }).length;
            return {
              id: `commands-reference-source:${provider.kind}`,
              label: `${provider.label.toUpperCase()} · ${setting?.enabled ? "ON" : "OFF"} · ${count}`,
              onAction: () => context.pushTask({
                type: "feature",
                feature: "commands",
                workspace: "reference-source",
                data: { sourceKind: provider.kind },
              }),
            };
          }),
        }],
      }],
    };
  },
});

export const commandReferenceSourceWorkspace = defineAuthorWorkspace({
  id: "commands-reference-source",
  matches: (route) => route.type === "feature" && route.feature === "commands" && route.workspace === "reference-source",
  createDraft: (route, context) => referenceSetting(
    context.snapshot.settings.commands,
    route.data?.sourceKind ?? "",
  ),
  buildSpec: ({ context, draft, setDraft }) => {
    const provider = semanticReferenceProvider(draft.sourceKind);
    if (!provider) {
      return {
        id: "commands-reference-source",
        title: "Target names",
        blocks: [{
          type: "status",
          id: "commands-reference-source-unknown",
          tone: "warning",
          text: "UNKNOWN TARGET TYPE.",
        }],
      };
    }

    const candidates = provider.candidates({ snapshot: context.snapshot, state: context.playState });
    return {
      id: "commands-reference-source",
      title: `Target names · ${provider.label}`,
      context: `${candidates.length} target${candidates.length === 1 ? "" : "s"}`,
      blocks: [
        {
          type: "toggle",
          id: "commands-reference-source-enabled",
          label: "Recognize this target type",
          checked: draft.enabled,
          onChange: (enabled) => setDraft((current) => ({ ...current, enabled })),
        },
        {
          type: "toggle",
          id: "commands-reference-source-defaults",
          label: "Use owner-supplied names, keys, tags, and contextual aliases",
          checked: draft.includeDefaults,
          onChange: (includeDefaults) => setDraft((current) => ({ ...current, includeDefaults })),
        },
        {
          type: "section",
          id: "commands-reference-source-aliases",
          label: "Custom aliases",
          importance: "primary",
          children: candidates.length
            ? candidates.map((candidate) => ({
              type: "section" as const,
              id: `commands-reference-source-candidate:${candidate.id}`,
              label: candidate.label,
              summary: candidate.detail,
              children: [
                ...(candidate.author && context.resources.canEdit(candidate.author.resourceKind, candidate.author.resourceId)
                  ? [{
                    type: "action-row" as const,
                    id: `commands-reference-source-edit:${candidate.id}`,
                    actions: [{
                      id: `commands-reference-source-edit-action:${candidate.id}`,
                      label: "EDIT SOURCE",
                      onAction: () => context.resources.edit(candidate.author!.resourceKind, candidate.author!.resourceId),
                    }],
                  }]
                  : []),
                {
                  type: "field" as const,
                  id: `commands-reference-source-aliases:${candidate.id}`,
                  label: "Additional names",
                  control: "textarea" as const,
                  rows: 2,
                  value: (draft.aliases[candidate.id] ?? []).join("\n"),
                  placeholder: "one additional player name per line",
                  onChange: (value: string) => setDraft((current) => ({
                    ...current,
                    aliases: {
                      ...current.aliases,
                      [candidate.id]: aliasLines(value),
                    },
                  })),
                },
              ],
            }))
            : [{
              type: "status" as const,
              id: "commands-reference-source-empty",
              text: `NO ${provider.label.toUpperCase()} TARGETS EXIST YET.`,
            }],
        },
      ],
      actions: provider.authorResourceKind && context.resources.canCreate(provider.authorResourceKind)
        ? [{
          id: "commands-reference-source-create",
          label: `+ CREATE ${provider.label.toUpperCase()}`,
          onAction: () => context.resources.create(provider.authorResourceKind!, () => undefined),
        }]
        : [],
    };
  },
  canSave: ({ draft }) => Boolean(semanticReferenceProvider(draft.sourceKind)),
  save: async ({ context, draft }) => {
    const provider = semanticReferenceProvider(draft.sourceKind);
    if (!provider) return { accepted: false };
    const commands = updateReferenceSetting(context.snapshot.settings.commands, draft);
    const result = await persistCommands(context, commands, `Changed ${provider.label} player vocabulary`);
    return { accepted: result.status === "saved" || result.status === "queued" };
  },
});

export const commandTargetBehaviorsWorkspace = defineAuthorWorkspace({
  id: "commands-target-behaviors",
  matches: (route) => route.type === "feature" && route.feature === "commands" && route.workspace === "target-behaviors",
  createDraft: () => ({}),
  buildSpec: ({ route, context }) => {
    const sourceKind = route.data?.sourceKind ?? "";
    const operation = route.data?.operation ?? "";
    const commandLabel = route.data?.commandLabel || operation || "Command";
    const adapter = context.resolveCommandTarget(sourceKind);
    const targets = adapter?.list(context.snapshot, operation) ?? [];
    return {
      id: "commands-target-behaviors",
      title: `${commandLabel} · target behavior`,
      context: adapter?.label ?? sourceKind,
      blocks: [
        ...(adapter && targets.length ? [{
          type: "action-row" as const,
          id: "commands-target-behavior-list",
          actions: targets.map((target) => ({
            id: `commands-target-behavior:${target.id}`,
            label: `${target.label} · ${target.available ? "AVAILABLE" : "OFF"} · ${target.responseCount} RESPONSE${target.responseCount === 1 ? "" : "S"}`,
            onAction: () => context.pushTask(adapter.editRoute(target.id, operation)),
          })),
        }] : []),
        ...(!adapter ? [{
          type: "status" as const,
          id: "commands-target-behavior-no-adapter",
          tone: "warning" as const,
          text: "NO AUTHORING ROUTE FOR THIS TARGET TYPE.",
        }] : []),
        ...(adapter && !targets.length ? [{
          type: "status" as const,
          id: "commands-target-behavior-empty",
          text: `NO ${adapter.label.toUpperCase()}S EXIST YET.`,
        }] : []),
      ],
      actions: adapter?.createRoute ? [{
        id: "commands-target-behavior-create",
        label: `+ CREATE ${adapter.label.toUpperCase()}`,
        onAction: () => context.pushTask(adapter.createRoute!(operation)),
      }] : [],
    };
  },
});

export const COMMAND_STRUCTURED_WORKSPACES = [
  commandWorkspace,
  commandInteractionsWorkspace,
  commandGrammarWorkspace,
  commandReferenceSourcesWorkspace,
  commandReferenceSourceWorkspace,
  commandTargetBehaviorsWorkspace,
] as const;
