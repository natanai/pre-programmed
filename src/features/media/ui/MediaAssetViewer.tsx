import { useEffect, useRef, useState } from "react";
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
  onEdit,
}: {
  snapshot: ProjectSnapshot;
  assetId: string;
  onOpen: () => void;
  onEdit?: () => void;
}) {
  const asset = configuredAssetStore.resolve(snapshot, assetId);
  if (!asset?.url || asset.kind !== "image") return null;

  return <span className={`media-inline-asset-shell${onEdit ? " is-authoring" : ""}`}>
    <button
      type="button"
      className={`media-inline-asset${asset.authoringMode === "vector-grid" ? " is-vector-grid" : ""}`
      aria-label={`Open ${asset.name}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onOpen}
    >
      <img src={asset.url} alt="" />
    </button>
    {onEdit ? <button type="button" className="media-inline-asset-edit" onPointerDown={(event) => event.stopPropagation()} onClick={onEdit}>[EDIT]</button> : null}
  </span>;
}

export function MediaAssetViewer({
  snapshot,
  assetId,
  onClose,
  onEdit,
}: {
  snapshot: ProjectSnapshot;
  assetId: string;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const viewerRef = useRef<HTMLElement>(null);
  const asset = configuredAssetStore.resolve(snapshot, assetId);

  useEffect(() => setZoom(1), [assetId]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    viewerRef.current?.focus({ preventScroll: true });
    return () => previousFocus?.focus({ preventScroll: true });
  }, [assetId]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const controls = [...viewer.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        if (!controls.length) {
          event.preventDefault();
          viewer.focus({ preventScroll: true });
          return;
        }
        const first = controls[0];
        const last = controls.at(-1)!;
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !viewer.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      let handled = true;
      if (event.key === "Escape") onClose();
      else if (event.key === "+" || event.key === "=") setZoom((value) => clampZoom(value + ZOOM_STEP));
      else if (event.key === "-") setZoom((value) => clampZoom(value - ZOOM_STEP));
      else if (event.key === "0") setZoom(1);
      else handled = false;
      if (!handled) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!asset?.url || asset.kind !== "image") return null;

  return <section
    ref={viewerRef}
    className="media-asset-viewer"
    role="dialog"
    aria-modal="true"
    aria-label={asset.name}
    tabIndex={-1}
    onPointerDown={(event) => event.stopPropagation()}
  >
    <header className="media-asset-viewer-toolbar">
      <span>{asset.name}</span>
      <div>
        <button type="button" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}>[−]</button>
        <button type="button" aria-label="Reset zoom" onClick={() => setZoom(1)}>[{Math.round(zoom * 100)}%]</button>
        <button type="button" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}>[+]</button>
        {onEdit ? <button type="button" onClick={onEdit}>[EDIT]</button> : null}
        <button type="button" onClick={onClose}>[CLOSE]</button>
      </div>
    </header>
    <div className="media-asset-viewer-stage">
      <div className="media-asset-viewer-scale" style={{ transform: `scale(${zoom})` }}>
        <img
          className={asset.authoringMode === "vector-grid" ? "is-vector-grid" : undefined}
          src={asset.url}
          alt={asset.name}
        />
      </div>
    </div>
  </section>;
}
