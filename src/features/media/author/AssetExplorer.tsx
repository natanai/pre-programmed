import { useState } from "react";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../ui/assetStore";
import { isVectorAsset, mediaAssetDimensions, type MediaAssetAuthoringMode, type MediaAssetKind } from "../model";
import { buildProjectReferences, missingProjectReferences } from "../../../author/references/projectReferences";
import type { AuthorTaskRoute } from "../../../author/tasks/types";

type AssetFilter = "all" | "images" | "audio" | "vectors";
type ListedAsset = ReturnType<typeof configuredAssetStore.list>[number];

function dimensionLabel(asset: ListedAsset) {
  const dimensions = mediaAssetDimensions(asset);
  if (!dimensions) return "";
  return dimensions.unit === "px"
    ? ` · ${dimensions.width}×${dimensions.height} px`
    : ` · ${dimensions.width}×${dimensions.height} units`;
}

function matchesAssetFilter(asset: ListedAsset, filter: AssetFilter) {
  if (filter === "all") return true;
  if (filter === "audio") return asset.kind === "audio";
  if (filter === "vectors") return isVectorAsset(asset);
  return asset.kind === "image" && !isVectorAsset(asset);
}

function assetSearchText(asset: ListedAsset) {
  const sourceKind = isVectorAsset(asset) ? "vector" : asset.kind;
  return `${asset.name} ${asset.id} ${asset.mimeType} ${sourceKind} ${asset.contentSource}`.toLowerCase();
}

export function AssetExplorer({ snapshot, onOpenAsset, onNewVector, onOpenReference }: {
  snapshot: ProjectSnapshot;
  onOpenAsset: (assetId: string, kind: MediaAssetKind, authoringMode: MediaAssetAuthoringMode) => void;
  onNewVector: () => void;
  onOpenReference: (route: AuthorTaskRoute) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssetFilter>("all");
  const allAssets = configuredAssetStore.list(snapshot);
  const normalizedQuery = query.trim().toLowerCase();
  const assets = allAssets.filter((asset) => matchesAssetFilter(asset, filter)
    && (!normalizedQuery || assetSearchText(asset).includes(normalizedQuery)));
  const counts: Record<AssetFilter, number> = {
    all: allAssets.length,
    images: allAssets.filter((asset) => matchesAssetFilter(asset, "images")).length,
    audio: allAssets.filter((asset) => matchesAssetFilter(asset, "audio")).length,
    vectors: allAssets.filter((asset) => matchesAssetFilter(asset, "vectors")).length,
  };
  const projectReferences = buildProjectReferences(snapshot);
  const mediaReferences = projectReferences.filter((reference) =>
    reference.resourceKind === "media-audio" || reference.resourceKind === "media-image" || reference.resourceKind === "media-sound");
  const missing = missingProjectReferences(snapshot).filter((reference) =>
    reference.resourceKind === "media-audio" || reference.resourceKind === "media-image" || reference.resourceKind === "media-sound");

  const filters: Array<{ id: AssetFilter; label: string }> = [
    { id: "all", label: "ALL" },
    { id: "images", label: "IMAGES" },
    { id: "audio", label: "AUDIO" },
    { id: "vectors", label: "VECTORS" },
  ];

  return <div className="asset-explorer" onPointerDown={(event) => event.stopPropagation()}>
    <input aria-label="Find media assets" placeholder="audio or image" value={query} onChange={(event) => setQuery(event.target.value)} />
    <div className="asset-filters" role="group" aria-label="Filter media assets">
      {filters.map((option) => <button
        type="button"
        key={option.id}
        aria-pressed={filter === option.id}
        onClick={() => setFilter(option.id)}
      >{option.label} {counts[option.id]}</button>)}
    </div>
    <div className="author-actions asset-actions">
      <button type="button" onClick={onNewVector}>[+ VECTOR]</button>
    </div>
    <div className="field-help">GENERATED MEDIA → D1 · FILE MEDIA → public/assets/</div>
    <div className="field-help">FILE ASSETS: put the media file in the appropriate <code>public/assets/</code> directory; the next build indexes it.</div>
    {missing.length ? <div className="asset-warning"><strong>MISSING LINKED ASSETS</strong>{missing.map((reference, index) => <button type="button" key={`${reference.ownerKind}:${reference.ownerId}:${reference.resourceId}:${index}`} onClick={() => reference.route && onOpenReference(reference.route)} disabled={!reference.route}>
      <span>{reference.resourceId}</span><small>{reference.ownerLabel} · {reference.detail}</small>
    </button>)}</div> : null}
    <div className="asset-list">{assets.map((asset) => {
      const usage = mediaReferences.filter((reference) => reference.resourceId === asset.id && (
        reference.resourceKind === `media-${asset.kind}` || (asset.kind === "audio" && reference.resourceKind === "media-sound")
      ));
      const sourceKind = isVectorAsset(asset) ? "vector" : asset.kind;
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
    {!assets.length ? <span className="asset-empty">{normalizedQuery ? "NO ASSETS MATCH." : `NO ${filter === "all" ? "MEDIA" : filter.toUpperCase()} ASSETS.`}</span> : null}
  </div>;
}
