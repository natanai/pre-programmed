import { useState } from "react";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../ui/assetStore";
import type { MediaAssetKind } from "../model";
import { buildProjectReferences, missingProjectReferences } from "../../../author/references/projectReferences";
import type { AuthorTaskRoute } from "../../../author/tasks/types";

export function AssetExplorer({ snapshot, onOpenAsset, onNewAsset, onNewVector, onOpenReference }: {
  snapshot: ProjectSnapshot;
  onClose: () => void;
  onOpenAsset: (assetId: string, kind: MediaAssetKind, authoringMode: "file" | "grid32") => void;
  onNewAsset: (kind: MediaAssetKind) => void;
  onNewVector: () => void;
  onOpenReference: (route: AuthorTaskRoute) => void;
}) {
  const [query, setQuery] = useState("");
  const assets = configuredAssetStore.list(snapshot).filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase()));
  const projectReferences = buildProjectReferences(snapshot);
  const mediaReferences = projectReferences.filter((reference) => reference.resourceKind === "media-audio" || reference.resourceKind === "media-image");
  const missing = missingProjectReferences(snapshot).filter((reference) => reference.resourceKind === "media-audio" || reference.resourceKind === "media-image");

  return <section className="author-panel author-panel-frame asset-explorer" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>MEDIA ASSETS</span></header>
    <div className="author-panel-body">
      <input aria-label="Search media assets" placeholder="sound or image" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="field-help">Every asset has one stable ID. Uploaded files, 32×32 vectors, and repository files use the same reference contract; storage locations never appear in authored rules.</div>
      <div className="author-actions">
        <button type="button" onClick={() => onNewAsset("audio")}>[+ SOUND FILE]</button>
        <button type="button" onClick={() => onNewAsset("image")}>[+ IMAGE FILE]</button>
        <button type="button" onClick={onNewVector}>[+ 32×32 VECTOR]</button>
      </div>
      {missing.length ? <div className="asset-warning"><strong>MISSING LINKED ASSETS</strong>{missing.map((reference, index) => <button type="button" key={`${reference.ownerKind}:${reference.ownerId}:${reference.resourceId}:${index}`} onClick={() => reference.route && onOpenReference(reference.route)} disabled={!reference.route}>
        <span>{reference.resourceId}</span><small>{reference.ownerLabel} · {reference.detail}</small>
      </button>)}</div> : null}
      <div className="asset-list">{assets.map((asset) => {
        const usage = mediaReferences.filter((reference) => reference.resourceId === asset.id && reference.resourceKind === `media-${asset.kind}`);
        return <button type="button" key={asset.id} onClick={() => onOpenAsset(asset.id, asset.kind, asset.authoringMode)}>
          <span>{asset.name}</span>
          <span>{asset.kind} · {asset.mimeType} · {asset.defaultPresentation} · {asset.byteLength}b{asset.intrinsicWidth && asset.intrinsicHeight ? ` · intrinsic ${asset.intrinsicWidth}×${asset.intrinsicHeight}` : ""} · {usage.length} use{usage.length === 1 ? "" : "s"}</span>
          <code>{asset.id}</code>
        </button>;
      })}</div>
      {!assets.length ? <span>No assets match.</span> : null}
    </div>
  </section>;
}
