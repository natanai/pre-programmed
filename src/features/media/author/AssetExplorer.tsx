import { useState } from "react";
import { isPremidiAsset } from "../ui/premidiRepository";
import { AuthorHelp } from "../../../author/ui/AuthorHelp";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../ui/assetStore";
import { isVectorAsset, mediaAssetDimensions, type MediaAssetAuthoringMode, type MediaAssetKind } from "../model";
import { buildProjectReferences, missingProjectReferences } from "../../../author/references/projectReferences";
import type { AuthorTaskRoute } from "../../../author/tasks/types";

type AssetFilter = "all" | "images" | "audio" | "music" | "vectors";
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
  if (filter === "audio") return asset.kind === "audio" && !isPremidiAsset(asset);
  if (filter === "music") return isPremidiAsset(asset);
  if (filter === "vectors") return isVectorAsset(asset);
  return asset.kind === "image" && !isVectorAsset(asset);
}

function assetSearchText(asset: ListedAsset) {
  const sourceKind = isPremidiAsset(asset) ? "music" : isVectorAsset(asset) ? "vector" : asset.kind;
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
    music: allAssets.filter((asset) => matchesAssetFilter(asset, "music")).length,
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
    { id: "music", label: "MUSIC" },
    { id: "vectors", label: "VECTORS" },
  ];

  return <div className="media-asset-explorer" onPointerDown={(event) => event.stopPropagation()}>
    <input aria-label="Find media assets" placeholder="find an asset" value={query} onChange={(event) => setQuery(event.target.value)} />
    <div className="media-asset-filters" role="group" aria-label="Filter media assets">
      {filters.map((option) => <button
        type="button"
        key={option.id}
        aria-pressed={filter === option.id}
        onClick={() => setFilter(option.id)}
      >{option.label} {counts[option.id]}</button>)}
    </div>
    <div className="author-actions media-asset-actions">
      <button type="button" onClick={onNewVector}>[+ VECTOR]</button>
      <AuthorHelp label="About media files" text="File Media, including .premidi music, is discovered from public/assets/ at build time or assets/ when the portable app launches. No upload is necessary." />
    </div>
    {missing.length ? <div className="media-asset-warning"><strong>MISSING LINKED ASSETS</strong>{missing.map((reference, index) => <button type="button" key={`${reference.ownerKind}:${reference.ownerId}:${reference.resourceId}:${index}`} onClick={() => reference.route && onOpenReference(reference.route)} disabled={!reference.route}>
      <span>{reference.resourceId}</span><small>{reference.ownerLabel} · {reference.detail}</small>
    </button>)}</div> : null}
    <div className="media-asset-list">{assets.map((asset) => {
      const usage = mediaReferences.filter((reference) => reference.resourceId === asset.id && (
        reference.resourceKind === `media-${asset.kind}` || (asset.kind === "audio" && reference.resourceKind === "media-sound")
      ));
      const sourceKind = isVectorAsset(asset) ? "vector" : asset.kind;
      const contentSource = asset.contentSource === "database"
        ? "project"
        : asset.contentSource === "repository"
          ? "file"
          : "broken reference";
      return <button type="button" key={asset.id} onClick={() => onOpenAsset(asset.id, asset.kind, asset.authoringMode)}>
        <span>{asset.name}{asset.available ? "" : " · MISSING CONTENT"}</span>
        <span>{sourceKind} · {contentSource}{dimensionLabel(asset)} · {usage.length} use{usage.length === 1 ? "" : "s"}</span>
      </button>;
    })}</div>
    {!assets.length ? <span className="media-asset-empty">{normalizedQuery ? "NO ASSETS MATCH." : `NO ${filter === "all" ? "MEDIA" : filter.toUpperCase()} ASSETS.`}</span> : null}
  </div>;
}
