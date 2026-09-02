import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";
import type {
  BodyBackgroundDefinition,
  BodySlotDefinition,
  MutationOperation,
  ProjectSnapshot,
} from "../../../game/model";
import { assetUrl } from "../../../data/assets";
import "./inventoryAuthor.css";

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
  return { id: crypto.randomUUID(), name: "", assetPath: "", slots: [], startingEquipment: [] };
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
  const slotKeysValid = useMemo(() => {
    const keys = draft.slots.map((slot) => slot.key.trim());
    return keys.every(Boolean) && new Set(keys).size === keys.length;
  }, [draft.slots]);
  const startingEquipmentValid = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of draft.startingEquipment ?? []) {
      counts.set(assignment.itemId, (counts.get(assignment.itemId) ?? 0) + 1);
    }
    return [...counts].every(([itemId, count]) => count <= (snapshot.items.find((item) => item.id === itemId)?.startingQuantity ?? 0));
  }, [draft.startingEquipment, snapshot.items]);

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
    if (!name || !slotKeysValid) return;
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
    if (!initial || !window.confirm(`Delete body type “${initial.name}”?`)) return;
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
        <label>BACKGROUND ASSET <select value={draft.assetPath} onChange={(event) => setDraft({ ...draft, assetPath: event.target.value })}>
          <option value="">none</option>
          {ASSET_MANIFEST.filter((asset) => asset.type === "image" && asset.runtimePath).map((asset) => <option value={asset.runtimePath!} key={asset.path}>{asset.path.replace(/^public\/assets\//, "")}</option>)}
        </select></label>
        <small className="field-help">Canvas is 3:4 portrait. A 3:4 image aligns cleanly with slots; other aspect ratios are contained and may leave empty space.</small>
        <div
          ref={canvasRef}
          className={`body-type-layout-editor${draft.assetPath ? " has-background" : ""}`}
          style={draft.assetPath ? { backgroundImage: `url("${assetUrl(draft.assetPath)}")` } : undefined}
          aria-label="Body slot layout editor"
        >
          {!draft.assetPath ? <span className="body-type-layout-empty">NO IMAGE SELECTED</span> : null}
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
                  (item.startingQuantity ?? 0) > 0
                  && (!(item.equipmentSlotKeys ?? []).length || (item.equipmentSlotKeys ?? []).includes(slot.key)),
                ).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.startingQuantity} starting</option>)}
              </select>
              <small>Uses one instance from the item’s starting quantity in each new playthrough.</small>
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
        {!startingEquipmentValid ? <p className="body-slot-error">Starting equipment assignments exceed an item’s starting quantity. Increase that item’s starting quantity or clear a slot.</p> : null}
      </section>
    </div>
    <div className="author-actions author-panel-footer">
      <button type="button" disabled={saving || !dirty || !draft.name.trim() || !slotKeysValid || !startingEquipmentValid} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>
      <button type="button" onClick={onCancel}>[CANCEL]</button>
      {initial ? <button type="button" className="danger" disabled={saving} onClick={() => void remove()}>[DELETE]</button> : null}
    </div>
  </section>;
}

/** Compatibility export while the file keeps its historical name. */
export const BodyBackgroundEditor = BodyTypeEditor;
