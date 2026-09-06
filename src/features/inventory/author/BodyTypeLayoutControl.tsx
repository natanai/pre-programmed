import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import { bodySlotPercentRect } from "../bodyCanvas";
import type { BodyBackgroundDefinition, BodySlotDefinition } from "../model";
import { BodyDiagram } from "../ui/BodyDiagram";
import "./inventoryAuthor.css";

type SlotTool = "move" | "resize";
type GuideMode = "off" | "quadrants" | "grid";

type SlotGesture = {
  slotId: string;
  mode: SlotTool;
  startClientX: number;
  startClientY: number;
  startSlot: BodySlotDefinition;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function guideDivisions(mode: GuideMode) {
  if (mode === "quadrants") return 2;
  if (mode === "grid") return 8;
  return 0;
}

function snapCoordinate(value: number, span: number, divisions: number, maximum: number) {
  if (!divisions) return clamp(value, 0, maximum);
  const step = span / divisions;
  return clamp(Math.round(value / step) * step, 0, maximum);
}

function nextGuideMode(mode: GuideMode): GuideMode {
  if (mode === "off") return "quadrants";
  if (mode === "quadrants") return "grid";
  return "off";
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
  const [tool, setTool] = useState<SlotTool>("move");
  const [guideMode, setGuideMode] = useState<GuideMode>("off");
  const canvasRef = useRef<HTMLDivElement>(null);
  const openedInitialSlotRef = useRef("");
  const backgroundAsset = configuredAssetStore.resolve(snapshot, draft.assetId);
  const canvas = draft.canvas;
  const divisions = guideDivisions(guideMode);

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
          if (gesture.mode === "move") {
            const maxX = canvas.width - gesture.startSlot.width;
            const maxY = canvas.height - gesture.startSlot.height;
            return {
              ...slot,
              x: snapCoordinate(gesture.startSlot.x + dx, canvas.width, divisions, maxX),
              y: snapCoordinate(gesture.startSlot.y + dy, canvas.height, divisions, maxY),
            };
          }

          const dominantDelta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
          const minimumSide = Math.min(1, canvas.width, canvas.height);
          const maximumSide = Math.min(canvas.width - gesture.startSlot.x, canvas.height - gesture.startSlot.y);
          let side = clamp(gesture.startSlot.width + dominantDelta, minimumSide, maximumSide);
          if (guideMode === "grid") {
            const sizeStep = Math.min(canvas.width, canvas.height) / 8;
            side = clamp(Math.round(side / sizeStep) * sizeStep, minimumSide, maximumSide);
          }
          return {
            ...slot,
            width: side,
            height: side,
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
  }, [canvas.height, canvas.width, divisions, draft, gesture, guideMode, onChange]);

  return <div className="body-type-layout-control">
    <BodyDiagram
      containerRef={canvasRef}
      canvas={canvas}
      backgroundUrl={backgroundAsset?.url}
      emptyText="NO IMAGE SELECTED"
      slots={(draft.slots ?? []).map((slot) => ({ slot }))}
    >
      {divisions ? <svg
        className="body-layout-editor-guides"
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {Array.from({ length: divisions - 1 }, (_, index) => index + 1).map((index) => <line
          key={`vertical-${index}`}
          className={index === divisions / 2 ? "major" : undefined}
          x1={(canvas.width / divisions) * index}
          x2={(canvas.width / divisions) * index}
          y1={0}
          y2={canvas.height}
          vectorEffect="non-scaling-stroke"
        />)}
        {Array.from({ length: divisions - 1 }, (_, index) => index + 1).map((index) => <line
          key={`horizontal-${index}`}
          className={index === divisions / 2 ? "major" : undefined}
          x1={0}
          x2={canvas.width}
          y1={(canvas.height / divisions) * index}
          y2={(canvas.height / divisions) * index}
          vectorEffect="non-scaling-stroke"
        />)}
      </svg> : null}
      <div className={`body-layout-editor-hit-layer mode-${tool}`}>
        {(draft.slots ?? []).map((slot) => {
          const rect = bodySlotPercentRect(slot, canvas);
          return <div
            className={`body-slot-editor-hit${gesture?.slotId === slot.id ? " active" : ""}`}
            key={slot.id}
            style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
            aria-label={`${tool === "move" ? "Move" : "Resize"} ${slot.name || slot.key}`}
            onPointerDown={(event) => {
              event.preventDefault();
              setGesture({ slotId: slot.id, mode: tool, startClientX: event.clientX, startClientY: event.clientY, startSlot: { ...slot } });
            }}
          />;
        })}
      </div>
    </BodyDiagram>

    <div className="body-slot-editor-toolbar">
      <button type="button" onClick={onAddSlot}>[+ SLOT]</button>
      <div className="body-slot-editor-tool-group" role="group" aria-label="Slot drag mode">
        <button type="button" aria-pressed={tool === "move"} onClick={() => setTool("move")}>[MOVE]</button>
        <button type="button" aria-pressed={tool === "resize"} onClick={() => setTool("resize")}>[SIZE]</button>
      </div>
      <button
        type="button"
        aria-label={`Alignment guides: ${guideMode}. Activate to cycle guides.`}
        onClick={() => setGuideMode((current) => nextGuideMode(current))}
      >[GUIDES: {guideMode.toUpperCase()}]</button>
      <small>
        Drag anywhere inside a slot to {tool === "move" ? "move" : "resize"} it. Slots stay square. Guides cycle OFF → QUADRANTS → GRID; visible guides also snap movement{guideMode === "grid" ? " and size" : ""}.
      </small>
    </div>

    <div className="body-slot-definition-list">
      {(draft.slots ?? []).map((slot) => <article key={slot.id} className="body-slot-definition-row">
        <div>
          <strong>{slot.name || slot.key}</strong>
          <small>{slot.key} · x {slot.x.toFixed(1)} · y {slot.y.toFixed(1)} · {slot.width.toFixed(1)} square</small>
        </div>
        <button type="button" onClick={() => onEditSlot(slot)}>[EDIT]</button>
      </article>)}
      {!(draft.slots ?? []).length ? <p className="field-help">No slots yet. Add only the semantic equipment locations that exist on this body type.</p> : null}
    </div>
  </div>;
}
