import { useState } from "react";
import type { ProjectSnapshot } from "../../../game/model";
import { configuredAssetStore } from "../ui/assetStore";
import type { MediaAssetKind } from "../model";

export function AssetExplorer({ snapshot, onOpenAsset, onNewAsset }: {
  snapshot: ProjectSnapshot;
  onClose: () => void;
  onOpenAsset: (assetId: string, kind: MediaAssetKind) => void;
  onNewAsset: (kind: MediaAssetKind) => void;
}) {
  const [query, setQuery] = useState("");
  const assets = configuredAssetStore.list(snapshot).filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase()));
  const referenced = new Set([
    ...snapshot.interactions.flatMap((interaction) => interaction.outcomes.flatMap((outcome) => outcome.effects.flatMap((effect) => effect.type === "audio" || effect.type === "art" ? [effect.assetId] : []))),
  ]);
  const availableIds = new Set(configuredAssetStore.list(snapshot).map((asset) => asset.id));
  const missing = [...referenced].filter((id) => !availableIds.has(id));

  return <section className="author-panel author-panel-frame asset-explorer" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>MEDIA ASSETS</span></header>
    <div className="author-panel-body">
      <input aria-label="Search media assets" placeholder="sound or image" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="field-help">Embedded assets travel with the authored project. Repository assets remain read-only build inputs but use the same stable selection contract.</div>
      <div className="author-actions"><button type="button" onClick={() => onNewAsset("audio")}>[+ SOUND]</button><button type="button" onClick={() => onNewAsset("image")}>[+ IMAGE]</button></div>
      {missing.length ? <div className="asset-warning"><strong>MISSING LINKED PATHS</strong>{missing.map((path) => <span key={path}>{path}</span>)}</div> : null}
      <div className="asset-list">{assets.map((asset) => <button type="button" key={asset.id} onClick={() => asset.source === "embedded" ? onOpenAsset(asset.id, asset.kind) : undefined}>
        <span>{asset.name}</span><span>{asset.kind} · {asset.source} · {asset.size}b {asset.width && asset.height ? `· ${asset.width}×${asset.height}${asset.width <= 32 && asset.height <= 32 ? " SPRITE" : " ART"}` : ""}</span><code>{asset.id}</code>
      </button>)}</div>
      {!assets.length ? <span>No assets match.</span> : null}
    </div>
  </section>;
}
