import { resolveAuthorKey } from "../../../author/generatedKey";
import { ValueMentionField } from "../../../author/ValueMentionField";
import { authorSemanticReferenceView } from "../../../engine/references/authorSyntax";
import { createEmptyPlayState } from "../../../engine/project/playState";
import { ConditionEditor } from "../../../author/ConditionEditor";
import { ALWAYS, type Condition } from "../../../engine/rules/model";
import { validateCondition } from "../../../engine/rules/conditions";
import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import { referencesTo } from "../../../author/references/projectReferences";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { characterAliasCondition, characterAliasName, type EntityDefinition } from "../model";
import { aliasesFromInput, normalizedAliases } from "./aliasInput";
import { characterStartingNameSelection } from "../playState";
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
  return { id: crypto.randomUUID(), key: "", type, name: "", aliases: [], startingNameSelection: "first", description: "", tags: [], portraitAssetId: null, interactable: false, operations: [], hooks: [] };
}

export const worldEntityWorkspace = defineAuthorWorkspace<EntityDraft>({
  id: "world-entity",
  matches: (route) => route.type === "feature" && route.feature === "world" && route.workspace === "entity",
  createDraft: (route, context) => {
    const entity = structuredClone(context.snapshot.entities.find((candidate) => candidate.id === route.data?.resourceId)
      ?? newEntity(route.data?.entityType === "location" ? "location" : "character"));
    return {
      ...entity,
      // Preserve the automatic startup draw only for older imported Characters
      // that actually authored unconditional aliases. Adding an alias to a
      // previously alias-less imported Character should not secretly randomize it.
      startingNameSelection: entity.startingNameSelection
        ?? ((entity.aliases ?? []).some((alias) => !characterAliasCondition(alias)) ? "random" : "first"),
      aliasesInput: (entity.aliases ?? []).map(characterAliasName).join("\n"),
    };
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
    const aliasReferenceContext = { snapshot: context.snapshot, state: context.playState ?? createEmptyPlayState(context.snapshot) };
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
                type: "custom" as const,
                id: "world-character-aliases",
                role: "specialized-control" as const,
                content: <div className="author-ui-field">
                  <span className="author-ui-label">Aliases</span>
                  <ValueMentionField
                    snapshot={context.snapshot}
                    playState={context.playState}
                    multiline
                    rows={4}
                    value={draft.aliasesInput ?? ""}
                    placeholder="One alternate name per line"
                    ariaLabel="Character aliases"
                    onValueChange={(value) => setDraft((current) => ({
                      ...current,
                      aliasesInput: value,
                      aliases: aliasesFromInput(value, current.aliases ?? []),
                    }))}
                  />
                  <small className="author-ui-help">Other names for this Character, one per line. Type @ to use a variable. Adding an alias does not change the displayed name unless you choose when to show it.</small>
                </div>,
              },
              ...(aliasEntries.length ? [{
                type: "select" as const,
                id: "world-character-starting-name",
                label: "Starting name in play",
                value: draft.startingNameSelection ?? characterStartingNameSelection(draft),
                options: [
                  { value: "first", label: "Use canonical name" },
                  { value: "random", label: "Choose with world seed" },
                ],
                help: draft.startingNameSelection === "random"
                  ? `A new game picks one of ${1 + aliasEntries.filter((alias) => !alias.condition).length} eligible names (including the canonical name) from the shared seed, and keeps that choice for the run. Names with WHEN rules are separate.`
                  : "The character starts with their canonical name. A WHEN rule below can change what players see later.",
                onChange: (startingNameSelection: string) => setDraft((current) => ({
                  ...current,
                  startingNameSelection: startingNameSelection === "random" ? "random" : "first",
                })),
              }, {
                type: "custom" as const,
                id: "world-character-alias-rules",
                role: "rule-editor" as const,
                content: <div className="world-alias-rules">
                  <small>Optional: show a nickname or other alias when a relationship or state changes. The first matching WHEN rule takes priority over the starting name.</small>
                  {aliasEntries.map((alias, index) => <div className={`world-alias-rule${alias.condition ? " world-alias-rule-active" : ""}`} key={index}>
                    <div className="world-alias-rule-header">
                      <strong>{authorSemanticReferenceView(alias.name, aliasReferenceContext).text}</strong>
                      <button type="button" aria-label={`${alias.condition ? "Remove display condition for" : "Show as name when"} ${authorSemanticReferenceView(alias.name, aliasReferenceContext).text}`}
                        onClick={() => setAliasCondition(index, alias.condition ? undefined : ALWAYS)}>
                        {alias.condition ? "[− REMOVE WHEN]" : "[+ SHOW WHEN...]"}
                      </button>
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
      draft: { ...saved, aliasesInput: (saved.aliases ?? []).map(characterAliasName).join("\n") },
      ...(route.data?.resourceTask ? { completion: { type: "resource" as const, kind: saved.type, id: saved.id, value: saved.id, label: saved.name || saved.key } } : {}),
    };
  },
});

export const WORLD_WORKSPACES = [worldLibraryWorkspace, worldEntityWorkspace] as const;
