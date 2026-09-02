import { resolveAuthorKey } from "../../../author/generatedKey";
import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { Inventory } from "../ui/Inventory";
import type { InventoryPresentation, ItemDefinition, ItemInventoryLayout } from "../model";

function itemRoute(id?: string, resourceTask = false) {
  return { type: "feature" as const, feature: "inventory", workspace: "item", data: { ...(id ? { itemId: id } : {}), ...(resourceTask ? { resourceTask: "item" } : {}) } };
}

export const inventoryPlayerWorkspace = defineAuthorWorkspace({
  id: "inventory-player",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "inventory",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "inventory-player", title: "Inventory", context: `${context.playState.inventory.reduce((total, entry) => total + entry.quantity, 0)} held`,
    blocks: [{ type: "custom", id: "inventory-player-control", role: "specialized-control", content: <Inventory snapshot={context.snapshot} state={context.playState} onState={context.runtime.updateState} onOutput={context.runtime.output} onEvents={context.runtime.events} /> }],
  }),
});

export const inventoryLibraryWorkspace = defineAuthorWorkspace({
  id: "inventory-library",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "library",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "inventory-library", title: "Inventory", context: `${context.snapshot.items.length} items · ${context.snapshot.inventoryPresentation.mode}`,
    blocks: [{ type: "custom", id: "inventory-library-list", role: "results", content: <div className="author-ui-resource-list">
      <button type="button" onClick={() => context.pushTask(itemRoute())}>[+ ITEM]</button>
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "inventory", workspace: "presentation" })}>[PRESENTATION]</button>
      {context.snapshot.items.map((item) => <button type="button" key={item.id} onClick={() => context.pushTask(itemRoute(item.id))}>{item.name || item.key}</button>)}
    </div> }],
  }),
});

type ItemDraft = { item: ItemDefinition; layout: ItemInventoryLayout };
function newItem(): ItemDefinition {
  return { id: crypto.randomUUID(), key: "", name: "", description: "", assetId: "", stackable: false, maxStack: 1, removable: true, startingQuantity: 0, interactable: true, operations: ["inspect", "use", "remove"], tags: [], initialState: {}, hooks: [] };
}

export const itemWorkspace = defineAuthorWorkspace<ItemDraft>({
  id: "inventory-item",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "item",
  createDraft: (route, context) => {
    const item = structuredClone(context.snapshot.items.find((candidate) => candidate.id === route.data?.itemId) ?? newItem());
    const layout = structuredClone(context.snapshot.itemInventoryLayouts.find((candidate) => candidate.itemId === item.id) ?? { itemId: item.id, width: 1, height: 1 });
    return { item, layout };
  },
  buildSpec: ({ context, draft, setDraft }) => ({
    id: "inventory-item", title: draft.item.name || "New item", context: "Possession definition",
    blocks: [
      { type: "section", id: "item-identity", label: "Item", importance: "primary", children: [
        { type: "field", id: "item-name", label: "Name", value: draft.item.name, autoFocus: !context.snapshot.items.some((item) => item.id === draft.item.id), onChange: (name) => setDraft((current) => ({ ...current, item: { ...current.item, name } })) },
        { type: "field", id: "item-key", label: "Key", value: draft.item.key, placeholder: "generated from name", onChange: (key) => setDraft((current) => ({ ...current, item: { ...current.item, key } })) },
        { type: "field", id: "item-description", label: "Description", control: "textarea", rows: 4, value: draft.item.description, onChange: (description) => setDraft((current) => ({ ...current, item: { ...current.item, description } })) },
        { type: "custom", id: "item-image", role: "resource-picker", content: <ReferenceField kind="media-image" value={draft.item.assetId} onChange={(assetId) => setDraft((current) => ({ ...current, item: { ...current.item, assetId } }))} placeholder="No image" /> },
      ] },
      { type: "section", id: "item-possession", label: "Possession", children: [
        { type: "field", id: "item-starting", label: "Starting quantity", control: "number", inputMode: "numeric", value: draft.item.startingQuantity, onChange: (value) => setDraft((current) => ({ ...current, item: { ...current.item, startingQuantity: Math.max(0, Number(value)) } })) },
        { type: "choice", id: "item-stackable", label: "Stacking", value: draft.item.stackable ? "stack" : "single", presentation: "segmented", onChange: (value) => setDraft((current) => ({ ...current, item: { ...current.item, stackable: value === "stack", maxStack: value === "stack" ? Math.max(2, current.item.maxStack) : 1 } })), options: [{ value: "single", label: "INDIVIDUAL" }, { value: "stack", label: "STACK" }] },
        ...(draft.item.stackable ? [{ type: "field" as const, id: "item-max-stack", label: "Maximum per stack", control: "number" as const, value: draft.item.maxStack, onChange: (value: string) => setDraft((current) => ({ ...current, item: { ...current.item, maxStack: Math.max(2, Number(value)) } })) }] : []),
      ] },
      ...(context.snapshot.inventoryPresentation.mode === "grid" ? [{ type: "disclosure" as const, id: "item-grid", label: "Grid footprint", summary: `${draft.layout.width} × ${draft.layout.height}`, children: [
        { type: "field" as const, id: "item-grid-width", label: "Width", control: "number" as const, value: draft.layout.width, onChange: (value: string) => setDraft((current) => ({ ...current, layout: { ...current.layout, width: Math.max(1, Number(value)) } })) },
        { type: "field" as const, id: "item-grid-height", label: "Height", control: "number" as const, value: draft.layout.height, onChange: (value: string) => setDraft((current) => ({ ...current, layout: { ...current.layout, height: Math.max(1, Number(value)) } })) },
      ] }] : []),
      { type: "disclosure", id: "item-tags", label: "Tags + instance state", summary: draft.item.tags.join(", ") || "Optional", children: [
        { type: "field", id: "item-tags-field", label: "Tags", value: draft.item.tags.join(", "), onChange: (value) => setDraft((current) => ({ ...current, item: { ...current.item, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) } })) },
        { type: "field", id: "item-state-json", label: "Initial instance state (JSON)", control: "textarea", rows: 3, value: JSON.stringify(draft.item.initialState), help: "Optional advanced per-instance data.", onChange: (value) => { try { const initialState = JSON.parse(value); if (initialState && typeof initialState === "object" && !Array.isArray(initialState)) setDraft((current) => ({ ...current, item: { ...current.item, initialState } })); } catch {} } },
      ] },
      { type: "disclosure", id: "item-behavior", label: "Player interactions", summary: draft.item.interactable ? `${draft.item.operations.length} operations` : "Not directly interactable", children: [{ type: "custom", id: "item-operations", role: "specialized-control", content: <OperationHooksEditor capability={{ interactable: draft.item.interactable, operations: draft.item.operations, hooks: draft.item.hooks }} snapshot={context.snapshot} targetKind="inventory.item" onChange={(capability) => setDraft((current) => ({ ...current, item: { ...current.item, ...capability } }))} /> }] },
    ],
  }),
  async save({ route, context, draft }) {
    const key = resolveAuthorKey({ override: draft.item.key, source: draft.item.name, existingKeys: context.snapshot.items.filter((item) => item.id !== draft.item.id).map((item) => item.key), fallback: "item" });
    const item = { ...draft.item, key };
    const result = await context.persist([{ type: "item.upsert", item }, { type: "itemInventoryLayout.upsert", layout: { ...draft.layout, itemId: item.id } }], `Save item ${item.name || key}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    return { accepted: true, draft: { item, layout: { ...draft.layout, itemId: item.id } }, ...(route.data?.resourceTask ? { completion: { type: "resource" as const, kind: "item", id: item.id, value: item.id, label: item.name || item.key } } : {}) };
  },
});

export const inventoryPresentationWorkspace = defineAuthorWorkspace<InventoryPresentation>({
  id: "inventory-presentation",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "presentation",
  createDraft: (_route, context) => structuredClone(context.snapshot.inventoryPresentation),
  buildSpec: ({ draft, setDraft }) => ({
    id: "inventory-presentation", title: "Inventory presentation", context: "Same possession data, different presentation",
    blocks: [{ type: "section", id: "inventory-presentation-main", label: "Presentation", importance: "primary", children: [
      { type: "choice", id: "inventory-mode", label: "Layout", value: draft.mode, presentation: "segmented", onChange: (mode) => setDraft(mode === "grid" ? { mode: "grid", columns: 10, rows: 6 } : { mode: "list" }), options: [{ value: "list", label: "LIST" }, { value: "grid", label: "GRID" }] },
      ...(draft.mode === "grid" ? [
        { type: "field" as const, id: "inventory-columns", label: "Columns", control: "number" as const, value: draft.columns, onChange: (value: string) => setDraft((current) => current.mode === "grid" ? { ...current, columns: Math.max(1, Number(value)) } : current) },
        { type: "field" as const, id: "inventory-rows", label: "Rows", control: "number" as const, value: draft.rows, onChange: (value: string) => setDraft((current) => current.mode === "grid" ? { ...current, rows: Math.max(1, Number(value)) } : current) },
      ] : []),
    ] }],
  }),
  async save({ context, draft }) {
    const result = await context.persist([{ type: "inventoryPresentation.upsert", presentation: draft }], "Save inventory presentation");
    return result.status === "saved" || result.status === "queued" ? { accepted: true } : { accepted: false };
  },
});

export const INVENTORY_WORKSPACES = [inventoryPlayerWorkspace, inventoryLibraryWorkspace, itemWorkspace, inventoryPresentationWorkspace] as const;
