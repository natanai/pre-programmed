import { resolveAuthorKey } from "../../../author/generatedKey";
import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { referencesTo } from "../../../author/references/projectReferences";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { giveInventoryItem } from "../runtime";
import type { ItemDefinition } from "../model";
import { Inventory } from "../ui/Inventory";
import "./inventoryWorkspaces.css";

const DEFAULT_ITEM_OPERATIONS = ["inspect", "use", "move", "remove", "equip", "unequip"];

export function inventoryRoute(workspace: "inventory" | "items" | "body-types" | "item" | "body-type", id?: string, resourceTask = false, preferredOperation?: string) {
  return {
    type: "feature" as const,
    feature: "inventory",
    workspace,
    data: {
      ...(workspace === "item" && id ? { itemId: id } : {}),
      ...(workspace === "body-type" && id ? { bodyTypeId: id } : {}),
      ...(resourceTask && workspace === "item" ? { resourceTask: "item" } : {}),
      ...(resourceTask && workspace === "body-type" ? { resourceTask: "body-type" } : {}),
      ...(preferredOperation ? { operation: preferredOperation, section: "operations" } : {}),
    },
  };
}

export const inventoryPlayerWorkspace = defineAuthorWorkspace({
  id: "inventory-player",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "inventory",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "inventory-player",
    title: "Inventory",
    context: "Items + body equipment",
    blocks: [{
      type: "custom",
      id: "inventory-player-surface",
      role: "specialized-control",
      content: <Inventory
        snapshot={context.snapshot}
        state={context.playState}
        onState={context.runtime.updateState}
        onOutput={context.runtime.output}
        onEvents={context.runtime.events}
      />,
    }],
    actions: context.authorMode ? [
      { id: "inventory-open-items", label: "ITEM DEFINITIONS", onAction: () => context.pushTask(inventoryRoute("items")) },
      { id: "inventory-open-body-types", label: "BODY TYPES", onAction: () => context.pushTask(inventoryRoute("body-types")) },
      { id: "inventory-create-item", label: "+ ITEM", onAction: () => context.pushTask(inventoryRoute("item")) },
    ] : [],
  }),
});

export const inventoryItemsWorkspace = defineAuthorWorkspace({
  id: "inventory-items",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "items",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "inventory-items",
    title: "Item definitions",
    context: `${context.snapshot.items.length} item${context.snapshot.items.length === 1 ? "" : "s"}`,
    blocks: [{
      type: "custom",
      id: "inventory-items-list",
      role: "results",
      content: <div className="inventory-author-resource-list">
        <button type="button" onClick={() => context.pushTask(inventoryRoute("item"))}>[+ ITEM]</button>
        {context.snapshot.items.map((item) => {
          const minimumStartingQuantity = Math.max(0, ...(context.snapshot.bodyBackgrounds ?? []).map((bodyType) =>
            (bodyType.startingEquipment ?? []).filter((assignment) => assignment.itemId === item.id).length,
          ));
          return <div className="inventory-author-resource-row" key={item.id}>
            <button type="button" className="inventory-author-resource-open" onClick={() => context.pushTask(inventoryRoute("item", item.id))}>
              <span>{item.name || item.key || "Untitled item"}</span><small>{item.key || "no key"}</small>
            </button>
            <div className="inventory-author-resource-actions">
              <span>DEFAULT</span>
              <button type="button" aria-label={`Decrease starting ${item.name}`} onClick={() => void context.persist([
                { type: "item.upsert", item: { ...item, startingQuantity: Math.max(minimumStartingQuantity, (item.startingQuantity ?? 0) - 1) } },
              ], `Changed starting ${item.name}`)}>[-]</button>
              <strong>{item.startingQuantity ?? 0}</strong>
              <button type="button" aria-label={`Increase starting ${item.name}`} onClick={() => void context.persist([
                { type: "item.upsert", item: { ...item, startingQuantity: (item.startingQuantity ?? 0) + 1 } },
              ], `Changed starting ${item.name}`)}>[+]</button>
              <button type="button" onClick={() => context.runtime.updateState(giveInventoryItem(context.snapshot, context.playState, item.id, 1))}>[ADD TO RUN]</button>
            </div>
          </div>;
        })}
      </div>,
    }],
  }),
});

function emptyItem(): ItemDefinition {
  return {
    id: crypto.randomUUID(), key: "", name: "", description: "", assetId: "", width: 1, height: 1,
    stackable: false, maxStack: 1, removable: true, startingQuantity: 1,
    interactable: true, operations: [...DEFAULT_ITEM_OPERATIONS], equipmentSlotKeys: [], equippedStorage: "inventory",
    equipOnGiveSlotKey: null, tags: [], initialState: {}, hooks: [],
  };
}

export const inventoryItemWorkspace = defineAuthorWorkspace<ItemDefinition>({
  id: "inventory-item",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "item",
  createDraft: (route, context) => {
    const initial = route.data?.itemId ? context.snapshot.items.find((candidate) => candidate.id === route.data?.itemId) : undefined;
    return {
      ...structuredClone(initial ?? emptyItem()),
      equipmentSlotKeys: [...(initial?.equipmentSlotKeys ?? [])],
      equippedStorage: initial?.equippedStorage ?? "inventory",
      equipOnGiveSlotKey: initial?.equipOnGiveSlotKey ?? null,
    };
  },
  buildSpec: ({ route, context, draft, setDraft }) => {
    const existing = context.snapshot.items.some((candidate) => candidate.id === draft.id);
    const slotOptions = (() => {
      const slots = new Map<string, Set<string>>();
      for (const bodyType of context.snapshot.bodyBackgrounds ?? []) {
        for (const slot of bodyType.slots ?? []) {
          const labels = slots.get(slot.key) ?? new Set<string>();
          labels.add(slot.name || slot.key);
          slots.set(slot.key, labels);
        }
      }
      return [...slots.entries()].map(([key, labels]) => ({ key, label: [...labels].join(" / ") }))
        .sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key));
    })();
    const minimumStartingQuantity = Math.max(0, ...(context.snapshot.bodyBackgrounds ?? []).map((bodyType) =>
      (bodyType.startingEquipment ?? []).filter((assignment) => assignment.itemId === draft.id).length,
    ));
    const usages = existing ? referencesTo(context.snapshot, "item", draft.id).filter((reference) => reference.ownerId !== draft.id) : [];
    const allowedGiveSlots = slotOptions.filter((slot) => !(draft.equipmentSlotKeys ?? []).length || (draft.equipmentSlotKeys ?? []).includes(slot.key));

    return {
      id: "inventory-item",
      title: draft.name || "New item",
      context: draft.key || "Inventory item",
      blocks: [
        {
          type: "section",
          id: "inventory-item-identity",
          label: "Item",
          importance: "primary",
          children: [
            { type: "field", id: "inventory-item-name", label: "Name", value: draft.name, autoFocus: !existing, onChange: (name) => setDraft((current) => ({ ...current, name })) },
            { type: "field", id: "inventory-item-description", label: "Description", control: "textarea", rows: 3, value: draft.description, onChange: (description) => setDraft((current) => ({ ...current, description })) },
            { type: "field", id: "inventory-item-tags", label: "Tags", value: draft.tags.join(", "), placeholder: "comma separated", onChange: (value) => setDraft((current) => ({ ...current, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })) },
            { type: "field", id: "inventory-item-key", label: "Key", value: draft.key, placeholder: "generated from name", onChange: (key) => setDraft((current) => ({ ...current, key })) },
          ],
        },
        {
          type: "disclosure",
          id: "inventory-item-tile",
          label: "Inventory tile",
          summary: `${draft.width}×${draft.height} · start ${draft.startingQuantity ?? 0}${draft.stackable ? " · stackable" : ""}`,
          children: [
            { type: "custom", id: "inventory-item-asset", role: "resource-picker", content: <ReferenceField kind="media-image" value={draft.assetId} onChange={(assetId) => setDraft((current) => ({ ...current, assetId }))} placeholder="none / text tile" /> },
            { type: "field", id: "inventory-item-width", label: "Width", control: "number", value: draft.width, onChange: (width) => setDraft((current) => ({ ...current, width: Math.max(1, Math.min(10, Number(width))) })) },
            { type: "field", id: "inventory-item-height", label: "Height", control: "number", value: draft.height, onChange: (height) => setDraft((current) => ({ ...current, height: Math.max(1, Math.min(6, Number(height))) })) },
            { type: "toggle", id: "inventory-item-stackable", label: "Stackable", checked: draft.stackable, onChange: (stackable) => setDraft((current) => ({ ...current, stackable, maxStack: stackable ? Math.max(1, current.maxStack) : 1 })) },
            { type: "field", id: "inventory-item-max-stack", label: "Maximum stack", control: "number", value: draft.maxStack, disabled: !draft.stackable, onChange: (maxStack) => setDraft((current) => ({ ...current, maxStack: Math.max(1, Math.floor(Number(maxStack))) })) },
            { type: "toggle", id: "inventory-item-removable", label: "Removal succeeds without an authored hook", checked: draft.removable, onChange: (removable) => setDraft((current) => ({ ...current, removable })) },
            { type: "field", id: "inventory-item-starting", label: "Starting quantity", control: "number", value: draft.startingQuantity ?? 0, help: minimumStartingQuantity ? `At least ${minimumStartingQuantity} required by body-type loadouts.` : "Total added to each new playthrough.", onChange: (value) => setDraft((current) => ({ ...current, startingQuantity: Math.max(minimumStartingQuantity, Math.floor(Number(value))) })) },
          ],
        },
        {
          type: "disclosure",
          id: "inventory-item-equipment",
          label: "Equipment",
          summary: (draft.equipmentSlotKeys ?? []).length ? `${draft.equipmentSlotKeys?.length} restricted slot${draft.equipmentSlotKeys?.length === 1 ? "" : "s"}` : "Any compatible body slot",
          children: [
            { type: "choice", id: "inventory-item-equipped-storage", label: "While equipped", value: draft.equippedStorage ?? "inventory", presentation: "segmented", onChange: (equippedStorage) => setDraft((current) => ({ ...current, equippedStorage: equippedStorage as "inventory" | "slot" })), options: [
              { value: "inventory", label: "STAYS IN INVENTORY" },
              { value: "slot", label: "BODY SLOT ONLY", help: "Frees its inventory-grid cells while equipped." },
            ] },
            { type: "select", id: "inventory-item-equip-on-give", label: "When given to player", value: draft.equipOnGiveSlotKey ?? "", onChange: (equipOnGiveSlotKey) => setDraft((current) => ({ ...current, equipOnGiveSlotKey: equipOnGiveSlotKey || null })), options: [
              { value: "", label: "keep in general inventory" },
              ...allowedGiveSlots.map((slot) => ({ value: slot.key, label: `equip to ${slot.label}` })),
            ] },
            { type: "custom", id: "inventory-item-compatible-slots", role: "specialized-control", content: <div className="inventory-slot-compatibility-control">
              <button type="button" aria-pressed={(draft.equipmentSlotKeys ?? []).length === 0} onClick={() => setDraft((current) => ({ ...current, equipmentSlotKeys: [] }))}>[ANY SLOT]</button>
              {slotOptions.map((slot) => <label key={slot.key}>
                <input type="checkbox" checked={(draft.equipmentSlotKeys ?? []).includes(slot.key)} onChange={(event) => setDraft((current) => ({
                  ...current,
                  equipmentSlotKeys: event.target.checked
                    ? [...(current.equipmentSlotKeys ?? []), slot.key]
                    : (current.equipmentSlotKeys ?? []).filter((key) => key !== slot.key),
                  equipOnGiveSlotKey: !event.target.checked && current.equipOnGiveSlotKey === slot.key ? null : current.equipOnGiveSlotKey,
                }))} /> {slot.label} <small>{slot.key}</small>
              </label>)}
              {!slotOptions.length ? <small>No body slots are authored yet. This item will remain compatible with future slots.</small> : null}
            </div> },
          ],
        },
        {
          type: "disclosure",
          id: "inventory-item-behavior",
          label: "Player behavior",
          summary: `${(draft.operations ?? []).length} operations · ${(draft.hooks ?? []).length} responses`,
          defaultOpen: route.data?.section === "operations" || Boolean(route.data?.operation),
          children: [{
            type: "custom",
            id: "inventory-item-operations",
            role: "specialized-control",
            content: <OperationHooksEditor
              snapshot={context.snapshot}
              targetKind="inventory.item"
              defaultOpen={route.data?.section === "operations" || Boolean(route.data?.operation)}
              preferredOperation={route.data?.operation}
              capability={{ interactable: draft.interactable ?? true, operations: draft.operations ?? DEFAULT_ITEM_OPERATIONS, hooks: draft.hooks ?? [] }}
              onChange={(capability) => setDraft((current) => ({ ...current, ...capability }))}
            />,
          }],
        },
      ],
      actions: existing ? [{
        id: "inventory-item-delete",
        label: `DELETE${usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}`,
        tone: "danger",
        disabled: usages.length > 0,
        onAction: () => {
          if (usages.length || !window.confirm(`Delete item “${draft.name}”?`)) return;
          void context.persist([{ type: "item.delete", id: draft.id }], `Delete item ${draft.name}`).then((result) => {
            if ((result.status === "saved" || result.status === "queued") && context.hasParentTask) context.leaveCurrentTask();
          });
        },
      }] : [],
    };
  },
  async save({ route, context, draft }) {
    if (!draft.name.trim()) return { accepted: false };
    const item = {
      ...draft,
      equipmentSlotKeys: [...(draft.equipmentSlotKeys ?? [])],
      key: resolveAuthorKey({
        override: draft.key,
        source: draft.name,
        existingKeys: context.snapshot.items.filter((candidate) => candidate.id !== draft.id).map((candidate) => candidate.key),
        fallback: "item",
      }),
    };
    const result = await context.persist([{ type: "item.upsert", item }], `${context.snapshot.items.some((candidate) => candidate.id === item.id) ? "Change" : "Create"} item ${item.name}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    return {
      accepted: true,
      draft: item,
      ...(route.data?.resourceTask ? { completion: { type: "resource" as const, kind: "item", id: item.id, value: item.id, label: item.name || item.key || "Untitled item" } } : {}),
    };
  },
});

export const INVENTORY_WORKSPACES = [
  inventoryPlayerWorkspace,
  inventoryItemsWorkspace,
  inventoryItemWorkspace,
] as const;
