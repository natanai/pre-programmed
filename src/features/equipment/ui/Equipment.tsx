import type { CSSProperties } from "react";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import { activeBodyType } from "../runtime";
import "./equipment.css";

export function Equipment({ snapshot, state }: { snapshot: ProjectSnapshot; state: PlayState }) {
  const bodyType = activeBodyType(snapshot, state);
  const bodyAsset = bodyType?.assetId ? configuredAssetStore.resolve(snapshot, bodyType.assetId) : null;
  return <div className="equipment-player-surface">
    <div className="equipment-body-heading"><span>BODY</span><strong>{bodyType?.name ?? "No active body type"}</strong></div>
    <div
      className={`equipment-body-canvas${bodyAsset?.url ? " has-background" : ""}`}
      style={bodyAsset?.url ? { backgroundImage: `url("${bodyAsset.url}")` } : undefined}
    >
      {!bodyAsset?.url ? <span className="equipment-no-image">{bodyType ? "NO BODY IMAGE" : "BODY TYPE NOT CONFIGURED"}</span> : null}
      {(bodyType?.slots ?? []).map((slot) => {
        const instanceId = state.equipmentAssignments[slot.key];
        const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
        const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
        const asset = item?.assetId ? configuredAssetStore.resolve(snapshot, item.assetId) : null;
        return <div
          className={`equipment-slot${item ? " is-occupied" : ""}`}
          key={slot.id}
          style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` } as CSSProperties}
          aria-label={item ? `${slot.name}: ${item.name}` : `${slot.name}: empty`}
        >
          {asset?.url ? <img src={asset.url} alt="" /> : item ? <strong>{item.name.slice(0, 3).toUpperCase()}</strong> : null}
          <small>{slot.name}</small>
        </div>;
      })}
    </div>
    {!bodyType?.slots.length ? <small className="equipment-empty">This body type has no equipment slots.</small> : null}
  </div>;
}
