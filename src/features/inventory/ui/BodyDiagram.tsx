import type { ReactNode, Ref } from "react";
import { bodySlotPercentRect } from "../bodyCanvas";
import type { BodyCanvasDefinition, BodySlotDefinition } from "../model";

export type BodyDiagramSlot = {
  slot: BodySlotDefinition;
  occupied?: boolean;
  canEquip?: boolean;
  imageUrl?: string;
  abbreviation?: string;
};

export function BodyDiagram({
  canvas,
  backgroundUrl,
  slots,
  emptyText,
  containerRef,
  children,
}: {
  canvas: BodyCanvasDefinition;
  backgroundUrl?: string;
  slots: readonly BodyDiagramSlot[];
  emptyText?: string;
  containerRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  return <div
    ref={containerRef}
    className={`body-diagram${backgroundUrl ? " has-background" : ""}`}
    style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
  >
    {backgroundUrl ? <img className="body-diagram-background" src={backgroundUrl} alt="" draggable={false} style={{ objectFit: canvas.fit }} /> : null}
    {!backgroundUrl && emptyText ? <span className="body-diagram-empty">{emptyText}</span> : null}
    <svg
      className="body-diagram-geometry"
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {slots.map(({ slot, occupied, canEquip }) => <rect
        key={slot.id}
        className={`body-diagram-slot-rect${occupied ? " occupied" : ""}${canEquip ? " can-equip" : ""}`}
        x={slot.x}
        y={slot.y}
        width={slot.width}
        height={slot.height}
        vectorEffect="non-scaling-stroke"
      />)}
    </svg>
    <div className="body-diagram-content" aria-hidden="true">
      {slots.map(({ slot, occupied, imageUrl, abbreviation }) => {
        const rect = bodySlotPercentRect(slot, canvas);
        return <div
          className={`body-diagram-slot-content${occupied ? " occupied" : ""}`}
          key={slot.id}
          style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
        >
          {imageUrl ? <img src={imageUrl} alt="" draggable={false} /> : occupied && abbreviation ? <strong>{abbreviation}</strong> : null}
          <small>{slot.name}</small>
        </div>;
      })}
    </div>
    {children}
  </div>;
}
