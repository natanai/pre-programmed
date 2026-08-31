import { useState } from "react";
import type { ProjectSnapshot } from "../../../game/model";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";

export function AssetExplorer({ snapshot }: { snapshot: ProjectSnapshot; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const assets = ASSET_MANIFEST.filter((asset) => asset.path.toLowerCase().includes(query.toLowerCase()));
  const referenced = new Set([
    ...snapshot.items.map((item) => item.assetPath).filter(Boolean),
    ...snapshot.interactions.flatMap((interaction) => interaction.outcomes.flatMap((outcome) => outcome.effects.flatMap((effect) => effect.type === "audio" || effect.type === "art" ? [effect.assetPath] : []))),
  ]);
  const runtimePaths = new Set(ASSET_MANIFEST.map((asset) => asset.runtimePath).filter(Boolean));
  const missing = [...referenced].filter((path) => !runtimePaths.has(path));

  return <section className="author-panel author-panel-frame asset-explorer" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>REPOSITORY ASSETS</span></header>
    <div className="author-panel-body">
      <input aria-label="Search repository assets" placeholder="local asset search" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="field-help">Add files under public/assets/ and deploy; detected art/audio becomes available to Author pickers automatically.</div>
      {missing.length ? <div className="asset-warning"><strong>MISSING LINKED PATHS</strong>{missing.map((path) => <span key={path}>{path}</span>)}</div> : null}
      <div className="asset-list">{assets.map((asset) => <div key={asset.path}><span>{asset.path.replace(/^public\/assets\//, "")}</span><span>{asset.type} · {asset.size}b {asset.dimensions ? `· ${asset.dimensions.width}×${asset.dimensions.height}${asset.dimensions.width <= 32 && asset.dimensions.height <= 32 ? " SPRITE" : " ART"}` : ""}</span><code>{asset.hash.slice(0, 12)}</code></div>)}</div>
      {!assets.length ? <span>No manifest matches.</span> : null}
    </div>
  </section>;
}
