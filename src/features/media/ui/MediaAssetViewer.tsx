import { useEffect, useState } from "react";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "./assetStore";
import "./mediaPlayer.css";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function MediaAssetThumbnail({
  snapshot,
  assetId,
  onOpen,
}: {
  snapshot: ProjectSnapshot;
  assetId: string;
  onOpen: () => void;
}) {
  const asset = configuredAssetStore.resolve(snapshot, assetId);
  if (!asset?.url || asset.kind !== "image") return null;

  return <button
    type="button"
    className={`media-inline-asset${asset.authoringMode === "grid32" ? " is-grid32" : ""}`}
    aria-label={`Open ${asset.name}`}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={onOpen}
  >
    <img src={asset.url} alt="" />
  </button>;
}

export function MediaAssetViewer({
  snapshot,
  assetId,
  onClose,
}: {
  snapshot: ProjectSnapshot;
  assetId: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const asset = configuredAssetStore.resolve(snapshot, assetId);

  useEffect(() => setZoom(1), [assetId]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") setZoom((value) => clampZoom(value + ZOOM_STEP));
      if (event.key === "-") setZoom((value) => clampZoom(value - ZOOM_STEP));
      if (event.key === "0") setZoom(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!asset?.url || asset.kind !== "image") return null;

  return <section
    className="media-asset-viewer"
    role="dialog"
    aria-modal="true"
    aria-label={asset.name}
    onPointerDown={(event) => event.stopPropagation()}
  >
    <header className="media-asset-viewer-toolbar">
      <span>{asset.name}</span>
      <div>
        <button type="button" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}>[−]</button>
        <button type="button" aria-label="Reset zoom" onClick={() => setZoom(1)}>[{Math.round(zoom * 100)}%]</button>
        <button type="button" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}>[+]</button>
        <button type="button" onClick={onClose}>[CLOSE]</button>
      </div>
    </header>
    <div className="media-asset-viewer-stage">
      <div className="media-asset-viewer-scale" style={{ transform: `scale(${zoom})` }}>
        <img
          className={asset.authoringMode === "grid32" ? "is-grid32" : undefined}
          src={asset.url}
          alt={asset.name}
        />
      </div>
    </div>
  </section>;
}
