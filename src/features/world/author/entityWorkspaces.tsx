import { resolveAuthorKey } from "../../../author/generatedKey";
import { ConditionEditor } from "../../../author/ConditionEditor";
import { ALWAYS, type Condition } from "../../../engine/rules/model";
import { validateCondition } from "../../../engine/rules/conditions";
import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import { referencesTo } from "../../../author/references/projectReferences";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { characterAliasCondition, characterAliasName, type CharacterAlias, type EntityDefinition } from "../model";
import "./worldWorkspaces.css";

export function worldEntityRoute(type: EntityDefinition["type"], id?: string, resourceTask = false, preferredOperation?: string) {
  return {
    type: "feature" as const,
    feature: "world",
    workspace: "entity",
    data: {
      entityType: type,
      ...(id ? { resourceId: id } : {}),
      ...(resourceTask ? { resourceTask: type } : {}),
      ...(preferredOperation ? { preferredOperation } : {}),
    },
  };
}

export const worldLibraryWorkspace = defineAuthorWorkspace({
  id: "world-library",
  matches: (route) => route.type === "feature" && route.feature === "world" && route.workspace === "library",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "world-library",
    title: "People + places",
    context: `${context.snapshot.entities.length} world entries`,
    blocks: [
      {
        type: "action-row",
        id: "world-entity-create-actions",
        actions: [
          { id: "world-entity-create-character", label: "+ CHARACTER", onAction: () => context.pushTask(worldEntityRoute("character")) },
          { id: "world-entity-create-location", label: "+ LOCATION", onAction: () => context.pushTask(worldEntityRoute("location")) },
        ],
      },
      {
        type: "custom",
        id: "world-entities",
        role: "results",
        content: <div className="world-author-resource-list">
          {context.snapshot.entities.map((entity) => <button type="button" key={entity.id} onClick={() => context.pushTask(worldEntityRoute(entity.type, entity.id))}>
            <span>{entity.name || entity.key}</span><small>{entity.type}</small>
          </button>)}
        </div>,
      },
    ],
  }),
});

type EntityDraft = EntityDefinition & { aliasesInput?: string };

function newEntity(type: EntityDefinition["type"]): EntityDraft {
  return { id: crypto.randomUUID(), key: "", type, name: "", aliases: [], description: "", tags: [], portraitAssetId: null, interactable: false, operations: [], hooks: [] };
}

function normalizedAliases(entity: EntityDefinition): CharacterAlias[] {
  const canonical = entity.name.trim().toLocaleLowerCase();
  const seen = new Set<string>();
  return (entity.aliases ?? []).flatMap((alias) => {
    const name = characterAliasName(alias).trim();
    const key = name.toLocaleLowerCase();
    if (!name || key === canonical || seen.has(key)) return [];
    seen.add(key);
    const condition = characterAliasCondition(alias);
    return [{ name, ...(condition ? { condition } : {}) }];
  });
}

/** Keep the exact in-progress textarea value; stripping blank lines here prevented Space and Enter. */
function aliasesFromInput(value: string, previous: readonly CharacterAlias[]): CharacterAlias[] {
  const names = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const remaining = new Set(names.map((name) => name.toLocaleLowerCase()));
  const taken = new Set<number>();
  return names.map((name, index) => {
    const matching = previous.findIndex((alias, oldIndex) =>
      !taken.has(oldIndex) && characterAliasName(alias).toLocaleLowerCase() === name.toLocaleLowerCase());
    // A changed name retains its rule, but inserting a new row cannot steal a later row's rule.
    const oldIndex = matching >= 0 ? matching
      : index < previous.length && !taken.has(index)
        && !remaining.has(characterAliasName(previous[index]).toLocaleLowerCase()) ? index : -1;
    if (oldIndex >= 0) taken.add(oldIndex);
    const condition = oldIndex >= 0 ? characterAliasCondition(previous[oldIndex]) : undefined;
    return { name, ...(condition ? { condition } : {}) };
  });
}

export const worldEntityWorkspace = defineAuthorWorkspace<EntityDraft>({
  id: "world-entity",
  matches: (route) => route.type === "feature" && route.feature === "world" && route.workspace === "entity",
  createDraft: (route, context) => {
    const entity = structuredClone(context.snapshot.entities.find((candidate) => candidate.id === route.data?.resourceId)
      ?? newEntity(route.data?.entityType === "location" ? "location" : "character"));
    return { ...entity, aliasesInput: (entity.aliases ?? []).map(characterAliasName).join("\n") };
  },
  buildSpec: ({ route, context, draft, setDraft }) => {
    const persisted = context.snapshot.entities.some((entity) => entity.id === draft.id);
    const usages = persisted
      ? referencesTo(context.snapshot, draft.type, draft.id).filter((reference) =>
          reference.ownerId !== draft.id || reference.ownerKind !== draft.type)
      : [];

    const setAliasCondition = (index: number, condition?: Condition) => setDraft((current) => ({
      ...current,
      aliases: (current.aliases ?? []).map((alias, candidateIndex) => {
        if (candidateIndex !== index) return alias;
        return { name: characterAliasName(alias), ...(condition ? { condition } : {}) };
      }),
    }));
    const aliasEntries = (draft.aliases ?? []).map((alias) => ({
      name: characterAliasName(alias),
      condition: characterAliasCondition(alias),
    }));
    const aliasErrors = aliasEntries.flatMap((alias) => alias.condition
      ? validateCondition(alias.condition).map((issue) => `${alias.name}: ${issue}`)
      : []);

    const deleteEntity = async () => {
      if (!persisted || usages.length) return;
      const label = draft.name || draft.key || draft.type;
      if (!window.confirm(`Delete ${draft.type} “${label}”? This cannot be undone.`)) return;
      const result = await context.persist(
        [{ type: "entity.delete", id: draft.id }],
        `Delete ${draft.type} ${label}`,
      );
      if (result.status !== "saved" && result.status !== "queued") return;
      context.leaveCurrentTask();
    };

    return {
      id: "world-entity",
      title: draft.name || `New ${draft.type}`,
      context: draft.type === "character" ? "Character" : "Location",
      blocks: [
        {
          type: "section",
          id: "world-entity-identity",
          label: draft.type === "character" ? "Character" : "Location",
          importance: "primary",
          children: [
            { type: "field", id: "world-entity-name", label: "Name", value: draft.name, autoFocus: !persisted, onChange: (name) => setDraft((current) => ({ ...current, name })) },
            ...(draft.type === "character" ? [
              {
                type: "field" as const,
                id: "world-character-aliases",
                label: "Aliases",
                control: "textarea" as const,
                rows: 4,
                value: draft.aliasesInput ?? "",
                placeholder: "one alternate name per line",
                help: "Type one name per line. Spaces and blank lines are kept while editing.",
                onChange: (value: string) => setDraft((current) => ({
                  ...current,
                  aliasesInput: value,
                  aliases: aliasesFromInput(value, current.aliases ?? []),
                })),
              },
              ...(aliasEntries.length ? [{
                type: "custom" as const,
                id: "world-character-alias-rules",
                role: "rule-editor" as const,
                content: <div className="world-alias-rules">
                  <small>Seeded names join the canonical name at world creation. Conditional names override that selection while their rule matches, in list order.</small>
                  {aliasEntries.map((alias, index) => <div className="world-alias-rule" key={index}>
                    <div className="world-alias-rule-header">
                      <strong>{alias.name}</strong>
                      <label>USE NAME
                        <select aria-label={`When to use ${alias.name}`} value={alias.condition ? "conditional" : "seeded"}
                          onChange={(event) => setAliasCondition(index, event.target.value === "conditional" ? ALWAYS : undefined)}>
                          <option value="seeded">Seeded at game start</option>
                          <option value="conditional">When condition matches</option>
                        </select>
                      </label>
                    </div>
                    {alias.condition ? <ConditionEditor
                      condition={alias.condition}
                      snapshot={context.snapshot}
                      onChange={(condition) => setAliasCondition(index, condition)}
                    /> : null}
                  </div>)}
                </div>,
              }] : []),
              ...(aliasErrors.length ? [{
                type: "status" as const,
                id: "world-character-alias-errors",
                tone: "error" as const,
                text: aliasErrors.join(" · "),
              }] : []),
              {
                type: "resource" as const,
                id: "world-character-portrait",
                label: "Portrait",
                kind: "media-image",
                value: draft.portraitAssetId ?? "",
                placeholder: "No portrait",
                showPreview: true,
                onChange: (portraitAssetId: string) => setDraft((current) => ({ ...current, portraitAssetId: portraitAssetId || null })),
              },
            ] : []),
            { type: "field", id: "world-entity-key", label: "Key", value: draft.key, placeholder: "generated from name", onChange: (key) => setDraft((current) => ({ ...current, key })) },
            { type: "field", id: "world-entity-description", label: "Description", control: "textarea", rows: 4, value: draft.description, onChange: (description) => setDraft((current) => ({ ...current, description })) },
            { type: "field", id: "world-entity-tags", label: "Tags", value: draft.tags.join(", "), placeholder: "comma separated", onChange: (value) => setDraft((current) => ({ ...current, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })) },
          ],
        },
        {
          type: "disclosure" as const,
          id: "world-entity-behavior",
          label: "Player interactions",
          summary: draft.interactable ? `${draft.operations?.length ?? 0} operations` : "Not directly interactable",
          defaultOpen: Boolean(route.data?.preferredOperation),
          children: [{
            type: "custom" as const,
            id: "world-entity-operations",
            role: "specialized-control" as const,
            content: <OperationHooksEditor
              capability={{ interactable: draft.interactable ?? false, operations: draft.operations ?? [], hooks: draft.hooks ?? [] }}
              snapshot={context.snapshot}
              targetKind={draft.type === "character" ? "world.character" : "world.location"}
              defaultOpen={Boolean(route.data?.preferredOperation)}
              preferredOperation={route.data?.preferredOperation}
              onChange={(capability) => setDraft((current) => ({ ...current, ...capability }))}
            />,
          }],
        },
        ...(usages.length ? [{
          type: "section" as const,
          id: "world-entity-references",
          label: "Used by",
          summary: `${usages.length} reference${usages.length === 1 ? "" : "s"} must be cleared before deletion`,
          importance: "secondary" as const,
          children: [{
            type: "custom" as const,
            id: "world-entity-reference-list",
            role: "results" as const,
            content: <div className="world-author-reference-list">
              {usages.map((reference, index) => reference.route
                ? <button type="button" key={`${reference.ownerKind}:${reference.ownerId}:${reference.detail}:${index}`} onClick={() => context.pushTask(reference.route!)}>
                    <span>{reference.ownerLabel}</span><small>{reference.detail}</small>
                  </button>
                : <div key={`${reference.ownerKind}:${reference.ownerId}:${reference.detail}:${index}`}>
                    <span>{reference.ownerLabel}</span><small>{reference.detail}</small>
                  </div>)}
            </div>,
          }],
        }] : []),
      ],
      actions: persisted ? [{
        id: "world-entity-delete",
        label: usages.length
          ? `DELETE ${draft.type.toUpperCase()} · ${usages.length} USE${usages.length === 1 ? "" : "S"}`
          : `DELETE ${draft.type.toUpperCase()}`,
        disabled: usages.length > 0,
        tone: "danger" as const,
        onAction: () => { void deleteEntity(); },
      }] : [],
    };
  },
  async save({ route, context, draft }) {
    if (!draft.name.trim()) return { accepted: false };
    if ((draft.aliases ?? []).some((alias) => characterAliasCondition(alias) && validateCondition(characterAliasCondition(alias)!).length)) return { accepted: false };
    const key = resolveAuthorKey({
      override: draft.key,
      source: draft.name,
      existingKeys: context.snapshot.entities.filter((entity) => entity.id !== draft.id).map((entity) => entity.key),
      fallback: draft.type,
    });
    const saved: EntityDefinition = draft.type === "character"
      ? { ...draft, key, aliases: normalizedAliases(draft) }
      : { ...draft, key, aliases: [], portraitAssetId: null };
    delete (saved as EntityDraft).aliasesInput;
    const result = await context.persist([{ type: "entity.upsert", entity: saved }], `Save ${saved.type} ${saved.name || key}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    return {
      accepted: true,
      draft: saved,
      ...(route.data?.resourceTask ? { completion: { type: "resource" as const, kind: saved.type, id: saved.id, value: saved.id, label: saved.name || saved.key } } : {}),
    };
  },
});

export const WORLD_WORKSPACES = [worldLibraryWorkspace, worldEntityWorkspace] as const;
