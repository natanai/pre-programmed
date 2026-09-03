import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import type { BodyBackgroundDefinition, BodySlotDefinition } from "../model";
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

export function BodyTypeLayoutControl({
  snapshot,
  draft,
  onChange,
}: {
  snapshot: ProjectSnapshot;
  draft: BodyBackgroundDefinition;
  onChange: (draft: BodyBackgroundDefinition) => void;
}) {
  const [gesture, setGesture] = useState<SlotGesture | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const backgroundAsset = configuredAssetStore.resolve(snapshot, draft.assetId);

  useEffect(() => {
    if (!gesture) return;
    const move = (event: PointerEvent) => {
      event.preventDefault();
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
      const dx = ((event.clientX - gesture.startClientX) / bounds.width) * 100;
      const dy = ((event.clientY - gesture.startClientY) / bounds.height) * 100;
      onChange({
        ...draft,
        slots: (draft.slots ?? []).map((slot) => {
          if (slot.id !== gesture.slotId) return slot;
          if (gesture.mode === "move") return {
            ...slot,
            x: clamp(gesture.startSlot.x + dx, 0, 100 - gesture.startSlot.width),
            y: clamp(gesture.startSlot.y + dy, 0, 100 - gesture.startSlot.height),
          };
          return {
            ...slot,
            width: clamp(gesture.startSlot.width + dx, 4, 100 - gesture.startSlot.x),
            height: clamp(gesture.startSlot.height + dy, 4, 100 - gesture.startSlot.y),
          };
        }),
      });
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
  }, [draft, gesture, onChange]);

  const updateSlot = (id: string, patch: Partial<BodySlotDefinition>) => {
    const previous = (draft.slots ?? []).find((slot) => slot.id === id);
    onChange({
      ...draft,
      slots: (draft.slots ?? []).map((slot) => slot.id === id ? { ...slot, ...patch } : slot),
      startingEquipment: patch.key !== undefined && previous
        ? (draft.startingEquipment ?? []).map((assignment) => assignment.slotKey === previous.key
          ? { ...assignment, slotKey: patch.key! }
          : assignment)
        : draft.startingEquipment,
    });
  };

  const addSlot = () => {
    const number = (draft.slots ?? []).length + 1;
    const slot: BodySlotDefinition = {
      id: crypto.randomUUID(), key: `slot_${number}`, name: `Slot ${number}`,
      x: 40, y: 40, width: 20, height: 12,
    };
    onChange({ ...draft, slots: [...(draft.slots ?? []), slot] });
  };

  return <div className="body-type-layout-control">
    <div
      ref={canvasRef}
      className={`body-type-layout-editor${backgroundAsset ? " has-background" : ""}`}
      style={backgroundAsset ? { backgroundImage: `url("${backgroundAsset.url}")` } : undefined}
      aria-label="Body slot layout editor"
    >
      {!backgroundAsset ? <span className="body-type-layout-empty">NO IMAGE SELECTED</span> : null}
      {(draft.slots ?? []).map((slot) => <div
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
      <small>Drag to move. Drag ↘ to resize. Percentage coordinates keep the same layout across screen sizes.</small>
    </div>

    <div className="body-slot-definition-list">
      {(draft.slots ?? []).map((slot) => <article key={slot.id} className="body-slot-definition-row">
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
        <small>Reuse a slot key on another body type when equipment should stay equipped across that change.</small>
        <label>STARTING EQUIPMENT
          <select
            value={(draft.startingEquipment ?? []).find((assignment) => assignment.slotKey === slot.key)?.itemId ?? ""}
            onChange={(event) => onChange({
              ...draft,
              startingEquipment: [
                ...(draft.startingEquipment ?? []).filter((assignment) => assignment.slotKey !== slot.key),
                ...(event.target.value ? [{ slotKey: slot.key, itemId: event.target.value }] : []),
              ],
            })}
          >
            <option value="">empty</option>
            {snapshot.items.filter((item) =>
              (item.startingQuantity ?? 0) > 0
              && (!(item.equipmentSlotKeys ?? []).length || (item.equipmentSlotKeys ?? []).includes(slot.key)),
            ).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.startingQuantity} starting</option>)}
          </select>
        </label>
        <button type="button" className="danger" onClick={() => onChange({
          ...draft,
          slots: (draft.slots ?? []).filter((candidate) => candidate.id !== slot.id),
          startingEquipment: (draft.startingEquipment ?? []).filter((assignment) => assignment.slotKey !== slot.key),
        })}>[REMOVE SLOT]</button>
      </article>)}
      {!(draft.slots ?? []).length ? <p className="field-help">No slots yet. Add only the slots that exist on this body type.</p> : null}
    </div>
  </div>;
}
