import { useEffect, useMemo, useState } from "react";
import { GeneratedKeyField } from "../../../author/GeneratedKeyField";
import { resolveAuthorKey } from "../../../author/generatedKey";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type { ItemDefinition, MutationOperation, ProjectSnapshot } from "../../../game/model";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";
import { OperationHooksEditor } from "../../../components/OperationHooksEditor";
import "./inventoryAuthor.css";

const DEFAULT_ITEM_OPERATIONS = ["inspect", "use", "move", "remove", "equip", "unequip"];

function emptyItem(): ItemDefinition {
  return {
    id: crypto.randomUUID(), key: "", name: "", description: "", assetPath: "", width: 1, height: 1,
    stackable: false, maxStack: 1, removable: true, startingQuantity: 1,
    interactable: true, operations: [...DEFAULT_ITEM_OPERATIONS], equipmentSlotKeys: [], tags: [], initialState: {}, hooks: [],
  };
}

export function ItemEditor({ snapshot, initial, onSave, onCancel, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  initial?: ItemDefinition;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    ...structuredClone(initial ?? emptyItem()),
    equipmentSlotKeys: [...(initial?.equipmentSlotKeys ?? [])],
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

  useEffect(() => {
    setWorkspaceDirty(dirty);
    return () => setWorkspaceDirty(false);
  }, [dirty, setWorkspaceDirty]);

  const save = async () => {
    if (!draft.name.trim()) return;
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
      }
    } finally { setSaving(false); }
  };

  return <section className="author-panel author-panel-frame item-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>ITEM · {draft.name || "NEW"}</span></header>
    <div className="author-panel-body item-editor-body">
      <section className="item-editor-section">
        <h3>IDENTITY</h3>
        <label>NAME <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus /></label>
        <label>DESCRIPTION <textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
        <GeneratedKeyField source={draft.name} value={draft.key} onChange={(key) => setDraft({ ...draft, key })} />
      </section>

      <section className="item-editor-section">
        <h3>INVENTORY TILE</h3>
        <label>ASSET <select value={draft.assetPath} onChange={(event) => setDraft({ ...draft, assetPath: event.target.value })}>
          <option value="">none / text tile</option>
          {ASSET_MANIFEST.filter((asset) => asset.type === "image" && asset.runtimePath).map((asset) => <option value={asset.runtimePath!} key={asset.path}>{asset.path.replace(/^public\/assets\//, "")}</option>)}
        </select></label>
        <div className="form-grid">
          <label>WIDTH <input type="number" min={1} max={10} value={draft.width} onChange={(event) => setDraft({ ...draft, width: Number(event.target.value) })} /></label>
          <label>HEIGHT <input type="number" min={1} max={6} value={draft.height} onChange={(event) => setDraft({ ...draft, height: Number(event.target.value) })} /></label>
          <label className="check-label"><input type="checkbox" checked={draft.stackable} onChange={(event) => setDraft({ ...draft, stackable: event.target.checked })} /> stackable</label>
          <label>MAX STACK <input type="number" min={1} value={draft.maxStack} onChange={(event) => setDraft({ ...draft, maxStack: Number(event.target.value) })} /></label>
          <label className="check-label"><input type="checkbox" checked={draft.removable} onChange={(event) => setDraft({ ...draft, removable: event.target.checked })} /> removal succeeds without a hook</label>
          <label>DEFAULT QUANTITY <input type="number" min={0} step={1} value={draft.startingQuantity ?? 0} onChange={(event) => setDraft({ ...draft, startingQuantity: Math.max(0, Math.floor(Number(event.target.value))) })} /><small>Placed in every new playthrough.</small></label>
        </div>
      </section>

      <section className="item-editor-section">
        <h3>EQUIPMENT</h3>
        <p className="field-help">Enable the <strong>equip</strong> operation below to let this item use body slots. Leaving every slot unchecked allows any slot on the current body type; checking slots restricts the item to those stable slot keys.</p>
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
              })}
            />
            {slot.label} <small>{slot.key}</small>
          </label>)}
        </div> : <p className="field-help">No body slots are authored yet. This item will be compatible with future slots unless you later restrict it.</p>}
      </section>

      <section className="item-editor-section">
        <h3>PLAYER BEHAVIOR</h3>
        <OperationHooksEditor snapshot={snapshot} targetKind="inventory.item" capability={{ interactable: draft.interactable ?? true, operations: draft.operations ?? DEFAULT_ITEM_OPERATIONS, hooks: draft.hooks ?? [] }}
          onChange={(capability) => setDraft({ ...draft, ...capability })} />
      </section>
    </div>
    <div className="author-actions author-panel-footer"><button type="button" disabled={saving || !dirty} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button><button type="button" onClick={onCancel}>[CANCEL]</button></div>
  </section>;
}
