from pathlib import Path

structured_path = Path("src/features/commands/author/structuredWorkspaces.ts")
structured = structured_path.read_text()

old_import = 'import { SEMANTIC_REFERENCE_PROVIDERS } from "../../../engine/references/catalog";\n'
new_import = 'import { SEMANTIC_REFERENCE_PROVIDERS, semanticReferenceProvider } from "../../../engine/references/catalog";\nimport { persistCommands, referenceSetting, updateReferenceSetting } from "./settingsPersistence";\n'
if structured.count(old_import) != 1:
    raise SystemExit("Expected one semantic reference import in structuredWorkspaces")
structured = structured.replace(old_import, new_import)

marker = '''function targetProviders() {
  return SEMANTIC_REFERENCE_PROVIDERS.filter((provider) => provider.targetable);
}
'''
replacement = marker + '''
function aliasLines(value: string) {
  return value.split("\\n").map((line) => line.trim()).filter(Boolean);
}
'''
if structured.count(marker) != 1:
    raise SystemExit("Expected one targetProviders helper")
structured = structured.replace(marker, replacement)

insert_before = 'export const commandTargetBehaviorsWorkspace = defineAuthorWorkspace({\n'
if structured.count(insert_before) != 1:
    raise SystemExit("Expected one target behavior workspace marker")
reference_workspace = '''export const commandReferenceSourceWorkspace = defineAuthorWorkspace({
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
                  value: (draft.aliases[candidate.id] ?? []).join("\\n"),
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

'''
structured = structured.replace(insert_before, reference_workspace + insert_before)

old_array = '''  commandReferenceSourcesWorkspace,
  commandTargetBehaviorsWorkspace,
] as const;
'''
new_array = '''  commandReferenceSourcesWorkspace,
  commandReferenceSourceWorkspace,
  commandTargetBehaviorsWorkspace,
] as const;
'''
if structured.count(old_array) != 1:
    raise SystemExit("Expected structured workspace registry tail")
structured = structured.replace(old_array, new_array)
structured_path.write_text(structured)

settings_path = Path("src/features/commands/author/CommandSettings.tsx")
settings = settings_path.read_text()

old_type_import = 'import type { CommandAction, CommandDefinition, CommandProjectSettings, CommandSlotDefinition, ReferenceSourceSetting } from "../model";\n'
new_type_import = 'import type { CommandAction, CommandDefinition, CommandProjectSettings, CommandSlotDefinition } from "../model";\nimport { persistCommands, referenceSetting, updateReferenceSetting } from "./settingsPersistence";\n'
if settings.count(old_type_import) != 1:
    raise SystemExit("Expected Commands model type import")
settings = settings.replace(old_type_import, new_type_import)

helper_start = settings.find('function referenceSetting(commands: CommandProjectSettings, sourceKind: string): ReferenceSourceSetting {')
helper_end = settings.find('function actionChoice(action: CommandAction) {')
if helper_start < 0 or helper_end < 0 or helper_end <= helper_start:
    raise SystemExit("Could not locate legacy Commands settings helper block")
settings = settings[:helper_start] + settings[helper_end:]

editor_start = settings.find('function ReferenceSourceEditor({ context, sourceKind }:')
editor_end = settings.find('function CommandEditor({ context, commandId, initialOperation = "", resourceTask }:')
if editor_start < 0 or editor_end < 0 or editor_end <= editor_start:
    raise SystemExit("Could not locate legacy ReferenceSourceEditor")
settings = settings[:editor_start] + settings[editor_end:]

old_route = '  if (route.workspace === "reference-source") return <ReferenceSourceEditor context={context} sourceKind={route.data?.sourceKind ?? ""} />;\n'
if settings.count(old_route) != 1:
    raise SystemExit("Expected one legacy reference-source renderer branch")
settings = settings.replace(old_route, '')

for forbidden in [
    'ReferenceSourceEditor',
    'ReferenceSourceSetting',
    'route.workspace === "reference-source"',
]:
    if forbidden in settings:
        raise SystemExit(f"Legacy Reference Source residue remains in CommandSettings: {forbidden}")
settings_path.write_text(settings)

css_path = Path("src/features/commands/author/commandSettings.css")
css = css_path.read_text()
replacements = {
    '.command-reference-editor,\n': '',
    '.command-reference-editor h3,\n': '',
    '.command-reference-candidates,\n': '',
    '.command-reference-candidate,\n': '',
    '.command-reference-candidate > label,\n': '',
    '.command-reference-candidates textarea,\n': '',
    '''.command-reference-candidate-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  min-width: 0;
}

.command-reference-candidate-heading > span {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--dos-bright);
}

.command-reference-candidate-heading > button {
  flex: none;
  min-height: 2.5em;
  padding: .3em .45em;
  border: 0;
  background: transparent;
  color: var(--dos-bright);
  font: inherit;
  cursor: pointer;
}

''': '',
    '''  .command-reference-candidate-heading > button {
    min-height: 2.75em;
    min-width: 4.75em;
  }

''': '',
}
for old, new in replacements.items():
    if old not in css:
        raise SystemExit(f"Expected legacy Reference Source CSS fragment: {old[:60]!r}")
    css = css.replace(old, new)
if 'command-reference-' in css:
    raise SystemExit("Legacy Reference Source CSS selectors remain")
css_path.write_text(css)

print("Commands Reference Source structured migration staged successfully")
