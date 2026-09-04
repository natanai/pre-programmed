import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import { referencesTo } from "../../../author/references/projectReferences";
import { createMediaAsset } from "../assets";
import type { MediaAsset, MediaAssetPresentation } from "../model";
import {
  DEFAULT_VECTOR_GRID_SIZE,
  VECTOR_GRID_MAX_CELLS,
  VECTOR_GRID_PRESETS,
  emptyVectorDocument,
  floodFillVectorGrid,
  paintVectorCell,
  parseVectorGrid,
  resizeVectorGrid,
  resizeWouldCrop,
  serializeVectorGrid,
  validateVectorGridSize,
  type VectorGridDocument,
} from "../vectorAsset";
import { configuredAssetContentStore, configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import "./mediaAuthor.css";

type Tool = "pencil" | "eraser" | "fill";
type Zoom = 1 | 2 | 4;

const VECTOR_CANVAS_LONG_EDGE_PIXELS = 1024;

function initialDocument(width?: number, height?: number) {
  const nextWidth = Number.isInteger(width) && Number(width) > 0 ? Number(width) : DEFAULT_VECTOR_GRID_SIZE.width;
  const nextHeight = Number.isInteger(height) && Number(height) > 0 ? Number(height) : DEFAULT_VECTOR_GRID_SIZE.height;
  return validateVectorGridSize(nextWidth, nextHeight)
    ? emptyVectorDocument()
    : emptyVectorDocument(nextWidth, nextHeight);
}

function coordinates(canvas: HTMLCanvasElement, document: VectorGridDocument, clientX: number, clientY: number) {
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(document.width - 1, Math.floor(((clientX - bounds.left) / bounds.width) * document.width)));
  const y = Math.max(0, Math.min(document.height - 1, Math.floor(((clientY - bounds.top) / bounds.height) * document.height)));
  return { x, y };
}

function renderVectorCanvas(canvas: HTMLCanvasElement, document: VectorGridDocument) {
  const longest = Math.max(document.width, document.height);
  const pixelScale = VECTOR_CANVAS_LONG_EDGE_PIXELS / longest;
  canvas.width = Math.max(1, Math.round(document.width * pixelScale));
  canvas.height = Math.max(1, Math.round(document.height * pixelScale));

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;
  const cellWidth = canvas.width / document.width;
  const cellHeight = canvas.height / document.height;
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);

  document.cells.forEach((cell, index) => {
    if (!cell) return;
    context.fillStyle = cell;
    context.fillRect(
      (index % document.width) * cellWidth,
      Math.floor(index / document.width) * cellHeight,
      cellWidth,
      cellHeight,
    );
  });

  context.beginPath();
  context.strokeStyle = "#333333";
  context.lineWidth = 1;
  for (let x = 1; x < document.width; x += 1) {
    const pixel = x * cellWidth;
    context.moveTo(pixel, 0);
    context.lineTo(pixel, canvas.height);
  }
  for (let y = 1; y < document.height; y += 1) {
    const pixel = y * cellHeight;
    context.moveTo(0, pixel);
    context.lineTo(canvas.width, pixel);
  }
  context.stroke();
}

function documentEqual(left: VectorGridDocument, right: VectorGridDocument) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function VectorAssetEditor({ snapshot, initial, initialWidth, initialHeight, onSave, onCancel, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  initial?: MediaAsset;
  initialWidth?: number;
  initialHeight?: number;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const startingDocument = useMemo(() => initialDocument(initialWidth, initialHeight), [initialWidth, initialHeight]);
  const [assetId] = useState(() => initial?.id ?? crypto.randomUUID());
  const [name, setName] = useState(initial?.name ?? "vector.svg");
  const [presentation, setPresentation] = useState<MediaAssetPresentation>(initial?.defaultPresentation ?? "inline");
  const [document, setDocument] = useState<VectorGridDocument>(startingDocument);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ name: initial?.name ?? "vector.svg", presentation: initial?.defaultPresentation ?? "inline", document: startingDocument }));
  const [undo, setUndo] = useState<VectorGridDocument[]>([]);
  const [redo, setRedo] = useState<VectorGridDocument[]>([]);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#ffffff");
  const [zoom, setZoom] = useState<Zoom>(1);
  const [resizeWidth, setResizeWidth] = useState(startingDocument.width);
  const [resizeHeight, setResizeHeight] = useState(startingDocument.height);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(initial));
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeStart = useRef<VectorGridDocument | null>(null);
  const activePointer = useRef<number | null>(null);
  const dirty = JSON.stringify({ name, presentation, document }) !== baseline;
  const usages = initial ? referencesTo(snapshot, "media-image", initial.id) : [];
  const hasProjectMetadata = Boolean(initial && snapshot.mediaAssets.some((asset) => asset.id === initial.id));
  const repositoryAvailable = configuredAssetContentStore.hasRepository(assetId);
  const sizeError = validateVectorGridSize(resizeWidth, resizeHeight);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) renderVectorCanvas(canvas, document);
  }, [document]);

  useEffect(() => {
    setResizeWidth(document.width);
    setResizeHeight(document.height);
  }, [document.width, document.height]);

  useEffect(() => {
    setWorkspaceDirty(dirty);
    return () => setWorkspaceDirty(false);
  }, [dirty, setWorkspaceDirty]);

  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    setLoading(true);
    void configuredAssetContentStore.fetch(initial).then(async (blob) => {
      const parsed = parseVectorGrid(await blob.text());
      if (cancelled) return;
      if (!parsed) {
        setError("This SVG is not a vector-grid asset created by this editor.");
        return;
      }
      setDocument(parsed);
      setUndo([]);
      setRedo([]);
      setBaseline(JSON.stringify({ name: initial.name, presentation: initial.defaultPresentation, document: parsed }));
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load vector content.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initial?.id, initial?.contentKey]);

  const commit = (next: VectorGridDocument) => {
    if (documentEqual(document, next)) return;
    setUndo((items) => [...items.slice(-49), document]);
    setRedo([]);
    setDocument(next);
  };

  const drawAt = (x: number, y: number) => {
    setDocument((current) => paintVectorCell(current, x, y, tool === "eraser" ? null : color));
  };

  const beginStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = coordinates(event.currentTarget, document, event.clientX, event.clientY);
    if (tool === "fill") {
      commit(floodFillVectorGrid(document, point.x, point.y, color));
      return;
    }
    activePointer.current = event.pointerId;
    strokeStart.current = document;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawAt(point.x, point.y);
  };

  const continueStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId || tool === "fill") return;
    event.preventDefault();
    const point = coordinates(event.currentTarget, document, event.clientX, event.clientY);
    drawAt(point.x, point.y);
  };

  const endStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    const before = strokeStart.current;
    strokeStart.current = null;
    setDocument((current) => {
      if (before && !documentEqual(before, current)) {
        setUndo((items) => [...items.slice(-49), before]);
        setRedo([]);
      }
      return current;
    });
  };

  const undoOnce = () => {
    const previous = undo.at(-1);
    if (!previous) return;
    setUndo((items) => items.slice(0, -1));
    setRedo((items) => [...items.slice(-49), document]);
    setDocument(previous);
  };

  const redoOnce = () => {
    const next = redo.at(-1);
    if (!next) return;
    setRedo((items) => items.slice(0, -1));
    setUndo((items) => [...items.slice(-49), document]);
    setDocument(next);
  };

  const choosePreset = (width: number, height: number) => {
    setResizeWidth(width);
    setResizeHeight(height);
  };

  const applyResize = () => {
    if (sizeError || (resizeWidth === document.width && resizeHeight === document.height)) return;
    if (resizeWouldCrop(document, resizeWidth, resizeHeight)
      && !window.confirm(`Resize to ${resizeWidth}×${resizeHeight}? Painted cells outside the new canvas will be cropped.`)) return;
    commit(resizeVectorGrid(document, resizeWidth, resizeHeight));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const svg = serializeVectorGrid(document);
      const content = new Blob([svg], { type: "image/svg+xml" });
      const contentKey = crypto.randomUUID();
      const asset = createMediaAsset({
        id: assetId,
        name: name.trim().toLowerCase().endsWith(".svg") ? name.trim() : `${name.trim()}.svg`,
        mimeType: "image/svg+xml",
        contentKey,
        byteLength: content.size,
        intrinsicWidth: document.width,
        intrinsicHeight: document.height,
        defaultPresentation: presentation,
        authoringMode: "vector-grid",
      });
      const result = await onSave(
        [{ type: "mediaAsset.upsert", asset, generatedContent: { mimeType: "image/svg+xml", text: svg } }],
        `${initial ? "Changed" : "Added"} vector asset ${asset.name}`,
      );
      if (result.status === "saved" || result.status === "queued") {
        setName(asset.name);
        setBaseline(JSON.stringify({ name: asset.name, presentation, document }));
      } else if (result.status === "failed") {
        setError(result.message ?? "Vector save failed.");
      } else {
        setError("Project changed on another device. Synchronize before saving this vector again.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Vector save failed.");
    } finally {
      setSaving(false);
    }
  };

  const resetOrDelete = async () => {
    if (!initial || !hasProjectMetadata) return;
    const resetting = repositoryAvailable;
    if (!resetting && usages.length) return;
    const prompt = resetting
      ? `Reset media asset “${initial.name}” to its repository definition?`
      : `Delete media asset “${initial.name}”?`;
    if (!window.confirm(prompt)) return;
    setSaving(true);
    try {
      const result = await onSave(
        [{ type: "mediaAsset.delete", id: initial.id }],
        resetting ? `Reset media asset ${initial.name} to repository copy` : `Deleted media asset ${initial.name}`,
      );
      if (result.status === "saved" || result.status === "queued") onCancel();
    } finally { setSaving(false); }
  };

  const exportAsset = async () => {
    if (dirty) return;
    const resolved = configuredAssetStore.resolve(snapshot, assetId);
    if (!resolved) return;
    setError("");
    try { await configuredAssetContentStore.exportAsset(resolved); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Asset export failed."); }
  };

  const lifecycleLabel = repositoryAvailable ? "RESET TO REPOSITORY" : "DELETE";
  const lifecycleDisabled = saving || (!repositoryAvailable && usages.length > 0);
  const usedCells = document.cells.filter(Boolean).length;
  const stageStyle = {
    width: `${zoom * 100}%`,
    maxWidth: `${34 * zoom}rem`,
    aspectRatio: `${document.width} / ${document.height}`,
  } as CSSProperties;

  return <section className="author-panel author-panel-frame vector-asset-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>VECTOR ASSET · {name || "NEW"}</span></header>
    <div className="author-panel-body vector-editor-body">
      <p className="field-help">The canvas uses logical drawing cells, not output pixels. Saving serializes the same grid to scalable SVG, so 32×32, 48×64, and custom canvases remain sharp at player zoom.</p>
      <div className="vector-editor-layout">
        <div className="vector-drawing-column">
          <div className="vector-zoom-row" aria-label="Vector canvas zoom">
            <span>VIEW</span>
            {([1, 2, 4] as const).map((candidate) => <button type="button" key={candidate} aria-pressed={zoom === candidate} onClick={() => setZoom(candidate)}>[{candidate === 1 ? "FIT" : `${candidate}×`}]</button>)}
          </div>
          <div className="vector-canvas-viewport">
            <div className="vector-canvas-stage" style={stageStyle}>
              <canvas
                ref={canvasRef}
                className="vector-canvas"
                role="img"
                aria-label={`${document.width} by ${document.height} vector drawing grid`}
                onPointerDown={beginStroke}
                onPointerMove={continueStroke}
                onPointerUp={endStroke}
                onPointerCancel={endStroke}
              />
            </div>
          </div>
        </div>
        <div className="vector-controls">
          <label>NAME <input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <section className="vector-canvas-settings" aria-label="Vector canvas size">
            <span>CANVAS · {document.width}×{document.height} UNITS</span>
            <div className="vector-preset-row">
              {VECTOR_GRID_PRESETS.map((preset) => <button type="button" key={preset.id} onClick={() => choosePreset(preset.width, preset.height)}>[{preset.label.toUpperCase()} · {preset.width}×{preset.height}]</button>)}
            </div>
            <div className="vector-size-row">
              <label>WIDTH <input type="number" min={1} step={1} value={resizeWidth} onChange={(event) => setResizeWidth(Number(event.target.value))} /></label>
              <label>HEIGHT <input type="number" min={1} step={1} value={resizeHeight} onChange={(event) => setResizeHeight(Number(event.target.value))} /></label>
              <button type="button" disabled={Boolean(sizeError) || (resizeWidth === document.width && resizeHeight === document.height)} onClick={applyResize}>[RESIZE CANVAS]</button>
            </div>
            <small>{sizeError ?? `Custom canvases may contain up to ${VECTOR_GRID_MAX_CELLS.toLocaleString()} logical cells. Resizing preserves existing cells without resampling.`}</small>
          </section>
          <label>COLOR <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
          <div className="author-actions vector-tool-row" aria-label="Drawing tools">
            {(["pencil", "eraser", "fill"] as const).map((candidate) => <button type="button" key={candidate} aria-pressed={tool === candidate} onClick={() => setTool(candidate)}>[{candidate.toUpperCase()}]</button>)}
          </div>
          <div className="author-actions vector-tool-row">
            <button type="button" disabled={!undo.length} onClick={undoOnce}>[UNDO]</button>
            <button type="button" disabled={!redo.length} onClick={redoOnce}>[REDO]</button>
            <button type="button" disabled={!usedCells} onClick={() => commit(emptyVectorDocument(document.width, document.height))}>[CLEAR]</button>
          </div>
          <label>DEFAULT PLAYER PRESENTATION
            <select value={presentation} onChange={(event) => setPresentation(event.target.value === "overlay" ? "overlay" : "inline")}>
              <option value="inline">inline / icon</option>
              <option value="overlay">large art / overlay</option>
            </select>
          </label>
          <small>{usedCells} / {document.width * document.height} cells used · SVG viewBox {document.width}×{document.height}.</small>
        </div>
      </div>
      {loading ? <div className="author-message">LOADING VECTOR CONTENT...</div> : null}
      {error ? <div className="author-message" role="alert">{error}</div> : null}
    </div>
    <div className="author-actions author-panel-footer">
      <button type="button" disabled={saving || loading || !dirty || !name.trim()} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE VECTOR"}]</button>
      {initial ? <button type="button" disabled={saving || dirty} title={dirty ? "Save changes before exporting." : undefined} onClick={() => void exportAsset()}>[EXPORT + ID]</button> : null}
      <button type="button" onClick={onCancel}>[CANCEL]</button>
      {initial && hasProjectMetadata ? <button
        type="button"
        className="danger"
        disabled={lifecycleDisabled}
        title={!repositoryAvailable && usages.length ? `Used by ${usages.map((usage) => usage.ownerLabel).join(", ")}` : undefined}
        onClick={() => void resetOrDelete()}
      >[{lifecycleLabel}{!repositoryAvailable && usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}]</button> : null}
    </div>
  </section>;
}