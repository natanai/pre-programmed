import { useState } from "react";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../ui/assetStore";
import { mediaAssetDimensions, type MediaAssetAuthoringMode, type MediaAssetKind } from "../model";
import { buildProjectReferences, missingProjectReferences } from "../../../author/references/projectReferences";
import type { AuthorTaskRoute } from "../../../author/tasks/types";

function dimensionLabel(asset: ReturnType<typeof configuredAssetStore.list>[number]) {
  const dimensions = mediaAssetDimensions(asset);
  if (!dimensions) return "";
  return dimensions.unit === "px"
    ? ` · ${dimensions.width}×${dimensions.height} px`
    : ` · ${dimensions.width}×${dimensions.height} units`;
}

export function AssetExplorer({ snapshot, onOpenAsset, onNewVector, onOpenReference }: {
  snapshot: ProjectSnapshot;
  onOpenAsset: (assetId: string, kind: MediaAssetKind, authoringMode: MediaAssetAuthoringMode) => void;
  onNewVector: () => void;
  onOpenReference: (route: AuthorTaskRoute) => void;
}) {
  const [query, setQuery] = useState("");
  const assets = configuredAssetStore.list(snapshot).filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase()));
  const projectReferences = buildProjectReferences(snapshot);
  const mediaReferences = projectReferences.filter((reference) =>
    reference.resourceKind === "media-audio" || reference.resourceKind === "media-image" || reference.resourceKind === "media-sound");
  const missing = missingProjectReferences(snapshot).filter((reference) =>
    reference.resourceKind === "media-audio" || reference.resourceKind === "media-image" || reference.resourceKind === "media-sound");

  return <div className="asset-explorer" onPointerDown={(event) => event.stopPropagation()}>
    <input aria-label="Find media assets" placeholder="sound or image" value={query} onChange={(event) => setQuery(event.target.value)} />
    <div className="author-actions">
      <button type="button" onClick={onNewVector}>[+ VECTOR]</button>
    </div>
    <div className="field-help">GENERATED MEDIA → D1 · FILE MEDIA → public/assets/</div>
    <div className="field-help">FILE ASSETS: add the media file and its <code>.asset.json</code> sidecar; the next build indexes both.</div>
    {missing.length ? <div className="asset-warning"><strong>MISSING LINKED ASSETS</strong>{missing.map((reference, index) => <button type="button" key={`${reference.ownerKind}:${reference.ownerId}:${reference.resourceId}:${index}`} onClick={() => reference.route && onOpenReference(reference.route)} disabled={!reference.route}>
      <span>{reference.resourceId}</span><small>{reference.ownerLabel} · {reference.detail}</small>
    </button>)}</div> : null}
    <div className="asset-list">{assets.map((asset) => {
      const usage = mediaReferences.filter((reference) => reference.resourceId === asset.id && (
        reference.resourceKind === `media-${asset.kind}` || (asset.kind === "audio" && reference.resourceKind === "media-sound")
      ));
      const sourceKind = asset.authoringMode === "vector-grid" ? "vector" : asset.kind;
      const contentSource = asset.contentSource === "database"
        ? "D1 generated"
        : asset.contentSource === "repository"
          ? "repository file"
          : "broken reference";
      return <button type="button" key={asset.id} onClick={() => onOpenAsset(asset.id, asset.kind, asset.authoringMode)}>
        <span>{asset.name}{asset.available ? "" : " · MISSING CONTENT"}</span>
        <span>{sourceKind} · {contentSource} · {asset.mimeType}{dimensionLabel(asset)} · {asset.defaultPresentation} · {asset.byteLength}b · {usage.length} use{usage.length === 1 ? "" : "s"}</span>
        <code>{asset.id}</code>
      </button>;
    })}</div>
    {!assets.length ? <span>NO ASSETS MATCH.</span> : null}
  </div>;
}
