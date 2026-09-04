import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import { bodySlotPercentRect } from "../bodyCanvas";
import type { BodyBackgroundDefinition, BodySlotDefinition } from "../model";
import { BodyDiagram } from "../ui/BodyDiagram";
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
  onAddSlot,
  onEditSlot,
  initialEditSlotId,
}: {
  snapshot: ProjectSnapshot;
  draft: BodyBackgroundDefinition;
  onChange: (draft: BodyBackgroundDefinition) => void;
  onAddSlot: () => void;
  onEditSlot: (slot: BodySlotDefinition) => void;
  initialEditSlotId?: string;
}) {
  const [gesture, setGesture] = useState<SlotGesture | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const openedInitialSlotRef = useRef("");
  const backgroundAsset = configuredAssetStore.resolve(snapshot, draft.assetId);
  const canvas = draft.canvas;

  useEffect(() => {
    if (!initialEditSlotId || openedInitialSlotRef.current === initialEditSlotId) return;
    const slot = (draft.slots ?? []).find((candidate) => candidate.id === initialEditSlotId);
    if (!slot) return;
    openedInitialSlotRef.current = initialEditSlotId;
    onEditSlot(slot);
  }, [draft.slots, initialEditSlotId, onEditSlot]);

  useEffect(() => {
    if (!gesture) return;
    const move = (event: PointerEvent) => {
      event.preventDefault();
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
      const dx = ((event.clientX - gesture.startClientX) / bounds.width) * canvas.width;
      const dy = ((event.clientY - gesture.startClientY) / bounds.height) * canvas.height;
      onChange({
        ...draft,
        slots: (draft.slots ?? []).map((slot) => {
          if (slot.id !== gesture.slotId) return slot;
          if (gesture.mode === "move") return {
            ...slot,
            x: clamp(gesture.startSlot.x + dx, 0, canvas.width - gesture.startSlot.width),
            y: clamp(gesture.startSlot.y + dy, 0, canvas.height - gesture.startSlot.height),
          };
          return {
            ...slot,
            width: clamp(gesture.startSlot.width + dx, Math.min(1, canvas.width), canvas.width - gesture.startSlot.x),
            height: clamp(gesture.startSlot.height + dy, Math.min(1, canvas.height), canvas.height - gesture.startSlot.y),
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
  }, [canvas.height, canvas.width, draft, gesture, onChange]);

  return <div className="body-type-layout-control">
    <BodyDiagram
      containerRef={canvasRef}
      canvas={canvas}
      backgroundUrl={backgroundAsset?.url}
      emptyText="NO IMAGE SELECTED"
      slots={(draft.slots ?? []).map((slot) => ({ slot }))}
    >
      <div className="body-layout-editor-hit-layer">
        {(draft.slots ?? []).map((slot) => {
          const rect = bodySlotPercentRect(slot, canvas);
          return <div
            className={`body-slot-editor-hit${gesture?.slotId === slot.id ? " active" : ""}`}
            key={slot.id}
            style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest(".body-slot-resize-handle")) return;
              event.preventDefault();
              setGesture({ slotId: slot.id, mode: "move", startClientX: event.clientX, startClientY: event.clientY, startSlot: { ...slot } });
            }}
          >
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
          </div>;
        })}
      </div>
    </BodyDiagram>

    <div className="body-slot-editor-toolbar">
      <button type="button" onClick={onAddSlot}>[+ SLOT]</button>
      <small>Drag a slot to move it; drag ↘ to resize. Geometry is stored in this Body Type's {canvas.width}×{canvas.height} logical canvas, not in screen pixels or image pixels.</small>
    </div>

    <div className="body-slot-definition-list">
      {(draft.slots ?? []).map((slot) => <article key={slot.id} className="body-slot-definition-row">
        <div>
          <strong>{slot.name || slot.key}</strong>
          <small>{slot.key} · x {slot.x.toFixed(1)} · y {slot.y.toFixed(1)} · {slot.width.toFixed(1)}×{slot.height.toFixed(1)}</small>
        </div>
        <button type="button" onClick={() => onEditSlot(slot)}>[EDIT]</button>
      </article>)}
      {!(draft.slots ?? []).length ? <p className="field-help">No slots yet. Add only the semantic equipment locations that exist on this body type.</p> : null}
    </div>
  </div>;
}
