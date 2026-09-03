import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthorWorkspaceSaveHandler } from "../../../author/features/types";
import { GeneratedKeyField } from "../../../author/GeneratedKeyField";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { resolveAuthorKey } from "../../../author/generatedKey";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import type { ItemDefinition } from "../model";
import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import "./inventoryAuthor.css";
import "./itemEditorDisclosure.css";
import { referencesTo } from "../../../author/references/projectReferences";

const DEFAULT_ITEM_OPERATIONS = ["inspect", "use", "move", "remove", "equip", "unequip"];

function emptyItem(): ItemDefinition {
  return {
    id: crypto.randomUUID(), key: "", name: "", description: "", assetId: "", width: 1, height: 1,
    stackable: false, maxStack: 1, removable: true, startingQuantity: 1,
    interactable: true, operations: [...DEFAULT_ITEM_OPERATIONS], equipmentSlotKeys: [], equippedStorage: "inventory",
    equipOnGiveSlotKey: null,
    tags: [], initialState: {}, hooks: [],
  };
}

function ItemEditorDisclosure({ title, summary, defaultOpen = false, children }: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  return <details className="item-editor-section item-editor-disclosure" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span>{title}</span><small>{summary}</small></summary>
    <div className="item-editor-disclosure-body">{children}</div>
  </details>;
}

export function ItemEditor({ snapshot, initial, openOperations = false, preferredOperation, onSave, onCancel, setWorkspaceDirty, onRegisterSave }: {
  snapshot: ProjectSnapshot;
  initial?: ItemDefinition;
  openOperations?: boolean;
  preferredOperation?: string;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel?: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
  onRegisterSave?: (handler: AuthorWorkspaceSaveHandler | null) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    ...structuredClone(initial ?? emptyItem()),
    equipmentSlotKeys: [...(initial?.equipmentSlotKeys ?? [])],
    equippedStorage: initial?.equippedStorage ?? "inventory",
    equipOnGiveSlotKey: initial?.equipOnGiveSlotKey ?? null,
  }));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [baseline, draft]);
  const slotOptions = useMemo(() => {
    const slots = new Map<string, Set<string>>();
    for (const bodyType of snapshot.bodyBackgrounds ?? []) {
      for (const slot of bodyType.slots ?? []) {
        const labels = slots.get(slot.key) ?? new Set<string>();
        labels.add(slot.name || slot.key);
        slots.set(slot.key, labels);
      }
    }
    return [...slots.entries()]
      .map(([key, labels]) => ({ key, label: [...labels].join(" / ") }))
      .sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key));
  }, [snapshot.bodyBackgrounds]);
  const minimumStartingQuantity = useMemo(() => Math.max(0, ...(snapshot.bodyBackgrounds ?? []).map((bodyType) =>
    (bodyType.startingEquipment ?? []).filter((assignment) => assignment.itemId === draft.id).length,
  )), [draft.id, snapshot.bodyBackgrounds]);
  const usages = initial ? referencesTo(snapshot, "item", initial.id).filter((reference) => reference.ownerId !== initial.id) : [];
  const operationCount = (draft.operations ?? []).length;
  const responseCount = (draft.hooks ?? []).length;

  useEffect(() => {
    setWorkspaceDirty(dirty);
    return () => setWorkspaceDirty(false);
  }, [dirty, setWorkspaceDirty]);

  const save = async (): Promise<boolean> => {
    if (!draft.name.trim()) return false;
    const item = {
      ...draft,
      equipmentSlotKeys: [...(draft.equipmentSlotKeys ?? [])],
      key: resolveAuthorKey({
        override: draft.key,
        source: draft.name,
        existingKeys: snapshot.items.filter((candidate) => candidate.id !== draft.id).map((candidate) => candidate.key),
        fallback: "item",
      }),
    };
    setDraft(item);
    setSaving(true);
    try {
      const result = await onSave([{ type: "item.upsert", item }], `${initial ? "Changed" : "Created"} item ${item.name}`);
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify(item));
        setWorkspaceDirty(false);
        return true;
      }
      return false;
    } finally { setSaving(false); }
  };

  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(save);
    return () => onRegisterSave(null);
  });

  const remove = async () => {
    if (!initial || usages.length || !window.confirm(`Delete item “${initial.name}”?`)) return;
    setSaving(true);
    try {
      const result = await onSave([{ type: "item.delete", id: initial.id }], `Deleted item ${initial.name}`);
      if (result.status === "saved" || result.status === "queued") onCancel?.();
    } finally { setSaving(false); }
  };

  return <section className="author-panel author-panel-frame item-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>ITEM · {draft.name || "NEW"}</span></header>
    <div className="author-panel-body item-editor-body">
      <ItemEditorDisclosure title="IDENTITY" summary={draft.name || "Name, description, tags"} defaultOpen>
        <label>NAME <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus={!initial} /></label>
        <label>DESCRIPTION <textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
        <GeneratedKeyField source={draft.name} value={draft.key} onChange={(key) => setDraft({ ...draft, key })} />
      </ItemEditorDisclosure>

      <ItemEditorDisclosure title="INVENTORY TILE" summary={`${draft.width}×${draft.height} · start ${draft.startingQuantity ?? 0}${draft.stackable ? " · stackable" : ""}`}>
        <label>ASSET <ReferenceField kind="media-image" value={draft.assetId} onChange={(assetId) => setDraft({ ...draft, assetId })} placeholder="none / text tile" /></label>
        <div className="form-grid">
          <label>WIDTH <input type="number" min={1} max={10} value={draft.width} onChange={(event) => setDraft({ ...draft, width: Number(event.target.value) })} /></label>
          <label>HEIGHT <input type="number" min={1} max={6} value={draft.height} onChange={(event) => setDraft({ ...draft, height: Number(event.target.value) })} /></label>
          <label className="check-label"><input type="checkbox" checked={draft.stackable} onChange={(event) => setDraft({ ...draft, stackable: event.target.checked })} /> stackable</label>
          <label>MAX STACK <input type="number" min={1} value={draft.maxStack} onChange={(event) => setDraft({ ...draft, maxStack: Number(event.target.value) })} /></label>
          <label className="check-label"><input type="checkbox" checked={draft.removable} onChange={(event) => setDraft({ ...draft, removable: event.target.checked })} /> removal succeeds without a hook</label>
          <label>STARTING QUANTITY <input type="number" min={minimumStartingQuantity} step={1} value={draft.startingQuantity ?? 0} onChange={(event) => setDraft({ ...draft, startingQuantity: Math.max(minimumStartingQuantity, Math.floor(Number(event.target.value))) })} /><small>Total in every new playthrough, including any starting equipped instances.{minimumStartingQuantity ? ` At least ${minimumStartingQuantity} required by body-type loadouts.` : ""}</small></label>
        </div>
      </ItemEditorDisclosure>

      <ItemEditorDisclosure title="EQUIPMENT" summary={(draft.equipmentSlotKeys ?? []).length ? `${draft.equipmentSlotKeys?.length} restricted slot${draft.equipmentSlotKeys?.length === 1 ? "" : "s"}` : "Any compatible body slot"}>
        <p className="field-help">Enable the <strong>equip</strong> operation below to let this item use body slots. Leaving every slot unchecked allows any slot on the current body type; checking slots restricts the item to those stable slot keys.</p>
        <label>EQUIPPED STORAGE
          <select value={draft.equippedStorage ?? "inventory"} onChange={(event) => setDraft({ ...draft, equippedStorage: event.target.value as "inventory" | "slot" })}>
            <option value="inventory">stays in general inventory</option>
            <option value="slot">body slot only</option>
          </select>
          <small>“Body slot only” frees its grid space while equipped. Unequipping requires enough free grid space.</small>
        </label>
        <label>WHEN GIVEN TO PLAYER
          <select value={draft.equipOnGiveSlotKey ?? ""} onChange={(event) => setDraft({ ...draft, equipOnGiveSlotKey: event.target.value || null })}>
            <option value="">keep in general inventory</option>
            {slotOptions.filter((slot) => !(draft.equipmentSlotKeys ?? []).length || (draft.equipmentSlotKeys ?? []).includes(slot.key)).map((slot) => (
              <option value={slot.key} key={slot.key}>equip to {slot.label} · {slot.key}</option>
            ))}
          </select>
          <small>Equips one newly granted instance to this stable slot key and safely moves any prior occupant back to general inventory. This does not affect starting equipment.</small>
        </label>
        {slotOptions.length ? <div className="equipment-slot-compatibility">
          <button type="button" aria-pressed={(draft.equipmentSlotKeys ?? []).length === 0} onClick={() => setDraft({ ...draft, equipmentSlotKeys: [] })}>[ANY SLOT]</button>
          {slotOptions.map((slot) => <label className="check-label" key={slot.key}>
            <input
              type="checkbox"
              checked={(draft.equipmentSlotKeys ?? []).includes(slot.key)}
              onChange={(event) => setDraft({
                ...draft,
                equipmentSlotKeys: event.target.checked
                  ? [...(draft.equipmentSlotKeys ?? []), slot.key]
                  : (draft.equipmentSlotKeys ?? []).filter((key) => key !== slot.key),
                equipOnGiveSlotKey: !event.target.checked && draft.equipOnGiveSlotKey === slot.key
                  ? null
                  : draft.equipOnGiveSlotKey,
              })}
            />
            {slot.label} <small>{slot.key}</small>
          </label>)}
        </div> : <p className="field-help">No body slots are authored yet. This item will be compatible with future slots unless you later restrict it.</p>}
      </ItemEditorDisclosure>

      <ItemEditorDisclosure title="PLAYER BEHAVIOR" summary={`${operationCount} operation${operationCount === 1 ? "" : "s"} · ${responseCount} response${responseCount === 1 ? "" : "s"}`} defaultOpen={openOperations || Boolean(preferredOperation)}>
        <OperationHooksEditor snapshot={snapshot} targetKind="inventory.item" defaultOpen={openOperations || Boolean(preferredOperation)} preferredOperation={preferredOperation} capability={{ interactable: draft.interactable ?? true, operations: draft.operations ?? DEFAULT_ITEM_OPERATIONS, hooks: draft.hooks ?? [] }}
          onChange={(capability) => setDraft({ ...draft, ...capability })} />
      </ItemEditorDisclosure>
    </div>
    <div className="author-actions author-panel-footer"><button type="button" disabled={saving || !dirty} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>{onCancel ? <button type="button" onClick={onCancel}>[BACK]</button> : null}{initial ? <button type="button" className="danger" disabled={saving || usages.length > 0} title={usages.length ? `Used by ${usages.map((usage) => usage.ownerLabel).join(", ")}` : undefined} onClick={() => void remove()}>[DELETE{usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}]</button> : null}</div>
  </section>;
}
