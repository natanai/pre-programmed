import { resolveAuthorKey } from "../../../author/generatedKey";
import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { EntityDefinition } from "../model";
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
    blocks: [{
      type: "custom",
      id: "world-entities",
      role: "results",
      content: <div className="world-author-resource-list">
        <div className="world-author-create-row">
          <button type="button" onClick={() => context.pushTask(worldEntityRoute("character"))}>[+ CHARACTER]</button>
          <button type="button" onClick={() => context.pushTask(worldEntityRoute("location"))}>[+ LOCATION]</button>
        </div>
        {context.snapshot.entities.map((entity) => <button type="button" key={entity.id} onClick={() => context.pushTask(worldEntityRoute(entity.type, entity.id))}>
          <span>{entity.name || entity.key}</span><small>{entity.type}</small>
        </button>)}
      </div>,
    }],
  }),
});

function newEntity(type: EntityDefinition["type"]): EntityDefinition {
  return { id: crypto.randomUUID(), key: "", type, name: "", description: "", tags: [], interactable: false, operations: [], hooks: [] };
}

export const worldEntityWorkspace = defineAuthorWorkspace<EntityDefinition>({
  id: "world-entity",
  matches: (route) => route.type === "feature" && route.feature === "world" && route.workspace === "entity",
  createDraft: (route, context) => structuredClone(context.snapshot.entities.find((candidate) => candidate.id === route.data?.resourceId) ?? newEntity(route.data?.entityType === "location" ? "location" : "character")),
  buildSpec: ({ route, context, draft, setDraft }) => ({
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
          { type: "field", id: "world-entity-name", label: "Name", value: draft.name, autoFocus: !context.snapshot.entities.some((item) => item.id === draft.id), onChange: (name) => setDraft((current) => ({ ...current, name })) },
          { type: "field", id: "world-entity-key", label: "Key", value: draft.key, placeholder: "generated from name", onChange: (key) => setDraft((current) => ({ ...current, key })) },
          { type: "field", id: "world-entity-description", label: "Description", control: "textarea", rows: 4, value: draft.description, onChange: (description) => setDraft((current) => ({ ...current, description })) },
          { type: "field", id: "world-entity-tags", label: "Tags", value: draft.tags.join(", "), placeholder: "comma separated", onChange: (value) => setDraft((current) => ({ ...current, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })) },
        ],
      },
      ...(draft.type === "location" ? [{
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
            targetKind="world.location"
            defaultOpen={Boolean(route.data?.preferredOperation)}
            preferredOperation={route.data?.preferredOperation}
            onChange={(capability) => setDraft((current) => ({ ...current, ...capability }))}
          />,
        }],
      }] : []),
    ],
  }),
  async save({ route, context, draft }) {
    if (!draft.name.trim()) return { accepted: false };
    const key = resolveAuthorKey({
      override: draft.key,
      source: draft.name,
      existingKeys: context.snapshot.entities.filter((entity) => entity.id !== draft.id).map((entity) => entity.key),
      fallback: draft.type,
    });
    const saved = draft.type === "character"
      ? { ...draft, key, interactable: false, operations: [], hooks: [] }
      : { ...draft, key };
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
