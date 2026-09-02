import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import type {
  BodyBackgroundDefinition,
  BodySlotDefinition,
  ItemDefinition,
} from "../model";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import "./inventoryAuthor.css";
import { referencesTo } from "../../../author/references/projectReferences";

type SlotGesture = {
  slotId: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  startSlot: BodySlotDefinition;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function emptyBodyType(): BodyBackgroundDefinition {
  return { id: crypto.randomUUID(), name: "", assetId: "", slots: [], startingEquipment: [] };
}

function placementKeys(item: ItemDefinition, anchorSlotKey: string) {
  const placements = item.equipmentPlacements ?? [];
  if (!placements.length) return [anchorSlotKey];
  const placement = placements.find((candidate) => candidate.anchorSlotKey === anchorSlotKey);
  if (!placement) return null;
  return [...new Set([anchorSlotKey, ...placement.occupiedSlotKeys])];
}

function itemFitsBodyAt(item: ItemDefinition, anchorSlotKey: string, slots: BodySlotDefinition[]) {
  const keys = placementKeys(item, anchorSlotKey);
  if (!keys) return false;
  const bodyKeys = new Set(slots.map((slot) => slot.key));
  return keys.every((key) => bodyKeys.has(key));
}

export function BodyTypeEditor({ snapshot, initial, onSave, onCancel, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  initial?: BodyBackgroundDefinition;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    ...structuredClone(initial ?? emptyBodyType()),
    slots: [...(initial?.slots ?? [])],
    startingEquipment: [...(initial?.startingEquipment ?? [])],
  }));
  const initiallyStarting = initial
    ? snapshot.startingBodyBackgroundId === initial.id
    : !snapshot.startingBodyBackgroundId && (snapshot.bodyBackgrounds ?? []).length === 0;
  const [starting, setStarting] = useState(initiallyStarting);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ draft, starting: initiallyStarting }));
  const [saving, setSaving] = useState(false);
  const [gesture, setGesture] = useState<SlotGesture | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dirty = useMemo(() => JSON.stringify({ draft, starting }) !== baseline, [baseline, draft, starting]);
  const backgroundAsset = configuredAssetStore.resolve(snapshot, draft.assetId);
  const slotKeysValid = useMemo(() => {
    const keys = draft.slots.map((slot) => slot.key.trim());
    return keys.every(Boolean) && new Set(keys).size === keys.length;
  }, [draft.slots]);
  const startingEquipmentValid = useMemo(() => {
    const counts = new Map<string, number>();
    const occupied = new Set<string>();
    for (const assignment of draft.startingEquipment ?? []) {
      const item = snapshot.items.find((candidate) => candidate.id === assignment.itemId);
      if (!item || !itemFitsBodyAt(item, assignment.slotKey, draft.slots)) return false;
      const keys = placementKeys(item, assignment.slotKey);
      if (!keys || keys.some((key) => occupied.has(key))) return false;
      keys.forEach((key) => occupied.add(key));
      counts.set(assignment.itemId, (counts.get(assignment.itemId) ?? 0) + 1);
    }
    return [...counts].every(([itemId, count]) => count <= (snapshot.items.find((item) => item.id === itemId)?.startingQuantity ?? 0));
  }, [draft.slots, draft.startingEquipment, snapshot.items]);
  const usages = initial ? referencesTo(snapshot, "body-type", initial.id) : [];

  useEffect(() => {
    setWorkspaceDirty(dirty);
    return () => setWorkspaceDirty(false);
  }, [dirty, setWorkspaceDirty]);

  useEffect(() => {
    if (!gesture) return;
    const move = (event: PointerEvent) => {
      event.preventDefault();
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
      const dx = ((event.clientX - gesture.startClientX) / bounds.width) * 100;
      const dy = ((event.clientY - gesture.startClientY) / bounds.height) * 100;
      setDraft((current) => ({
        ...current,
        slots: current.slots.map((slot) => {
          if (slot.id !== gesture.slotId) return slot;
          if (gesture.mode === "move") {
            return {
              ...slot,
              x: clamp(gesture.startSlot.x + dx, 0, 100 - gesture.startSlot.width),
              y: clamp(gesture.startSlot.y + dy, 0, 100 - gesture.startSlot.height),
            };
          }
          return {
            ...slot,
            width: clamp(gesture.startSlot.width + dx, 4, 100 - gesture.startSlot.x),
            height: clamp(gesture.startSlot.height + dy, 4, 100 - gesture.startSlot.y),
          };
        }),
      }));
    };
    const end = () => setGesture(null);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [gesture]);

  const updateSlot = (id: string, patch: Partial<BodySlotDefinition>) => setDraft((current) => {
    const previous = current.slots.find((slot) => slot.id === id);
    return {
      ...current,
      slots: current.slots.map((slot) => slot.id === id ? { ...slot, ...patch } : slot),
      startingEquipment: patch.key !== undefined && previous
        ? (current.startingEquipment ?? []).map((assignment) => assignment.slotKey === previous.key
          ? { ...assignment, slotKey: patch.key! }
          : assignment)
        : current.startingEquipment,
    };
  });

  const addSlot = () => {
    const number = draft.slots.length + 1;
    const slot: BodySlotDefinition = {
      id: crypto.randomUUID(),
      key: `slot_${number}`,
      name: `Slot ${number}`,
      x: 40,
      y: 40,
      width: 20,
      height: 12,
    };
    setDraft({ ...draft, slots: [...draft.slots, slot] });
  };

  const save = async () => {
    const name = draft.name.trim();
    if (!name || !slotKeysValid || !startingEquipmentValid) return;
    const bodyType = {
      ...draft,
      name,
      slots: draft.slots.map((slot) => ({
        ...slot,
        key: slot.key.trim(),
        name: slot.name.trim() || slot.key.trim(),
      })),
      startingEquipment: (draft.startingEquipment ?? []).filter((assignment) =>
        draft.slots.some((slot) => slot.key.trim() === assignment.slotKey.trim()),
      ).map((assignment) => ({ ...assignment, slotKey: assignment.slotKey.trim() })),
    };
    const operations: MutationOperation[] = [{ type: "bodyBackground.upsert", background: bodyType }];
    if (starting && snapshot.startingBodyBackgroundId !== bodyType.id) {
      operations.push({ type: "bodyBackground.starting", id: bodyType.id });
    } else if (!starting && snapshot.startingBodyBackgroundId === bodyType.id) {
      operations.push({ type: "bodyBackground.starting", id: null });
    }
    setDraft(bodyType);
    setSaving(true);
    try {
      const result = await onSave(
        operations,
        `${initial ? "Changed" : "Created"} body type ${bodyType.name}`,
      );
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify({ draft: bodyType, starting }));
        setWorkspaceDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial || usages.length || !window.confirm(`Delete body type “${initial.name}”?`)) return;
    setSaving(true);
    try {
      const result = await onSave(
        [{ type: "bodyBackground.delete", id: initial.id }],
        `Deleted body type ${initial.name}`,
      );
      if (result.status === "saved" || result.status === "queued") onCancel();
    } finally {
      setSaving(false);
    }
  };

  return <section className="author-panel author-panel-frame body-type-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>BODY TYPE · {draft.name || "NEW"}</span></header>
    <div className="author-panel-body item-editor-body">
      <section className="item-editor-section">
        <h3>IDENTITY</h3>
        <label>NAME <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus /></label>
        <small>A body type can represent age, form, species, armor layout, transformation, or any other body configuration.</small>
        <label className="check-label body-type-starting-toggle"><input type="checkbox" checked={starting} onChange={(event) => setStarting(event.target.checked)} /> START NEW PLAYTHROUGHS WITH THIS BODY TYPE</label>
      </section>

      <section className="item-editor-section">
        <h3>BODY IMAGE + SLOT LAYOUT</h3>
        <label>BACKGROUND ASSET <ReferenceField kind="media-image" value={draft.assetId} onChange={(assetId) => setDraft({ ...draft, assetId })} placeholder="none" /></label>
        <div
          ref={canvasRef}
          className={`body-type-layout-editor${backgroundAsset ? " has-background" : ""}`}
          style={backgroundAsset ? { backgroundImage: `url("${backgroundAsset.url}")` } : undefined}
          aria-label="Body slot layout editor"
        >
          {!backgroundAsset ? <span className="body-type-layout-empty">NO IMAGE SELECTED</span> : null}
          {draft.slots.map((slot) => <div
            className={`body-slot-editor-rect${gesture?.slotId === slot.id ? " active" : ""}`}
            key={slot.id}
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` }}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest(".body-slot-resize-handle")) return;
              event.preventDefault();
              setGesture({ slotId: slot.id, mode: "move", startClientX: event.clientX, startClientY: event.clientY, startSlot: { ...slot } });
            }}
          >
            <span>{slot.name || slot.key}</span>
            <button
              type="button"
              className="body-slot-resize-handle"
              aria-label={`Resize ${slot.name || slot.key}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setGesture({ slotId: slot.id, mode: "resize", startClientX: event.clientX, startClientY: event.clientY, startSlot: { ...slot } });
              }}
            >↘</button>
          </div>)}
        </div>
        <div className="body-slot-editor-toolbar">
          <button type="button" onClick={addSlot}>[+ SLOT]</button>
          <small>Drag a slot to move it. Drag ↘ to resize it. Coordinates are saved as percentages so the same layout scales across screens.</small>
        </div>
        <div className="body-slot-definition-list">
          {draft.slots.map((slot) => <article key={slot.id} className="body-slot-definition-row">
            <div className="body-slot-name-key">
              <label>NAME <input value={slot.name} onChange={(event) => updateSlot(slot.id, { name: event.target.value })} /></label>
              <label>SLOT KEY <input value={slot.key} onChange={(event) => updateSlot(slot.id, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_") })} /></label>
            </div>
            <div className="body-slot-coordinate-grid">
              <label>X <input type="number" min={0} max={100} step={0.5} value={Number(slot.x.toFixed(1))} onChange={(event) => updateSlot(slot.id, { x: clamp(Number(event.target.value), 0, 100 - slot.width) })} /></label>
              <label>Y <input type="number" min={0} max={100} step={0.5} value={Number(slot.y.toFixed(1))} onChange={(event) => updateSlot(slot.id, { y: clamp(Number(event.target.value), 0, 100 - slot.height) })} /></label>
              <label>W <input type="number" min={4} max={100} step={0.5} value={Number(slot.width.toFixed(1))} onChange={(event) => updateSlot(slot.id, { width: clamp(Number(event.target.value), 4, 100 - slot.x) })} /></label>
              <label>H <input type="number" min={4} max={100} step={0.5} value={Number(slot.height.toFixed(1))} onChange={(event) => updateSlot(slot.id, { height: clamp(Number(event.target.value), 4, 100 - slot.y) })} /></label>
            </div>
            <small>Reuse the same slot key on another body type if equipment should remain equipped when the body type changes.</small>
            <label>STARTING EQUIPMENT
              <select
                value={(draft.startingEquipment ?? []).find((assignment) => assignment.slotKey === slot.key)?.itemId ?? ""}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  startingEquipment: [
                    ...(current.startingEquipment ?? []).filter((assignment) => assignment.slotKey !== slot.key),
                    ...(event.target.value ? [{ slotKey: slot.key, itemId: event.target.value }] : []),
                  ],
                }))}
              >
                <option value="">empty</option>
                {snapshot.items.filter((item) =>
                  (item.startingQuantity ?? 0) > 0 && itemFitsBodyAt(item, slot.key, draft.slots),
                ).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.startingQuantity} starting</option>)}
              </select>
              <small>Uses one instance from the item’s starting quantity. Multi-slot placements reserve every occupied slot in this loadout.</small>
            </label>
            <button type="button" className="danger" onClick={() => setDraft({
              ...draft,
              slots: draft.slots.filter((candidate) => candidate.id !== slot.id),
              startingEquipment: (draft.startingEquipment ?? []).filter((assignment) => assignment.slotKey !== slot.key),
            })}>[REMOVE SLOT]</button>
          </article>)}
          {!draft.slots.length ? <p className="field-help">No slots yet. Add only the slots that exist on this body type; another body type may have more or fewer.</p> : null}
        </div>
        {!slotKeysValid ? <p className="body-slot-error">Each slot needs a unique, non-empty slot key.</p> : null}
        {!startingEquipmentValid ? <p className="body-slot-error">Starting equipment is invalid: check item quantities, placement anchors, required body slots, and overlapping occupied slots.</p> : null}
      </section>
    </div>
    <div className="author-actions author-panel-footer">
      <button type="button" disabled={saving || !dirty || !draft.name.trim() || !slotKeysValid || !startingEquipmentValid} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>
      <button type="button" onClick={onCancel}>[CANCEL]</button>
      {initial ? <button type="button" className="danger" disabled={saving || usages.length > 0} title={usages.length ? `Used by ${usages.map((usage) => usage.ownerLabel).join(", ")}` : undefined} onClick={() => void remove()}>[DELETE{usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}]</button> : null}
    </div>
  </section>;
}

/** Compatibility export while the file keeps its historical name. */
export const BodyBackgroundEditor = BodyTypeEditor;
