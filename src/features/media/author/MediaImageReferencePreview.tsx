import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../ui/assetStore";
import "./mediaImageReferencePreview.css";

export function MediaImageReferencePreview({
  snapshot,
  assetId,
  onEdit,
}: {
  snapshot: ProjectSnapshot;
  assetId: string;
  onEdit?: () => void;
}) {
  const asset = configuredAssetStore.resolve(snapshot, assetId);
  if (!asset?.url || asset.kind !== "image") return null;

  return <button
    type="button"
    className="media-image-reference-preview"
    disabled={!onEdit}
    aria-label={onEdit ? `Edit image ${asset.name}` : asset.name}
    onClick={onEdit}
  >
    <span className="media-image-reference-preview-frame">
      <img
        className={asset.authoringMode === "vector-grid" ? "is-vector-grid" : undefined}
        src={asset.url}
        alt=""
      />
    </span>
    <span className="media-image-reference-preview-copy">
      <strong>{asset.name}</strong>
      {onEdit ? <small>[EDIT IMAGE]</small> : null}
    </span>
  </button>;
}
