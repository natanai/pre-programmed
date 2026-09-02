import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import { referencesTo } from "../../../author/references/projectReferences";
import { createMediaAsset } from "../assets";
import type { MediaAsset, MediaAssetPresentation } from "../model";
import {
  emptyVectorGrid,
  floodFillVectorGrid,
  paintVectorCell,
  parseVectorGrid,
  serializeVectorGrid,
  VECTOR_GRID_SIZE,
  type VectorCell,
} from "../vectorAsset";
import { configuredAssetContentStore, configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import "./mediaAuthor.css";

type Tool = "pencil" | "eraser" | "fill";

const VECTOR_CANVAS_PIXELS = 1024;

function coordinates(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(VECTOR_GRID_SIZE - 1, Math.floor(((clientX - bounds.left) / bounds.width) * VECTOR_GRID_SIZE)));
  const y = Math.max(0, Math.min(VECTOR_GRID_SIZE - 1, Math.floor(((clientY - bounds.top) / bounds.height) * VECTOR_GRID_SIZE)));
  return { x, y };
}

function renderVectorCanvas(canvas: HTMLCanvasElement, cells: readonly VectorCell[]) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;

  const cellPixels = canvas.width / VECTOR_GRID_SIZE;
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);

  cells.forEach((cell, index) => {
    if (!cell) return;
    context.fillStyle = cell;
    context.fillRect(
      (index % VECTOR_GRID_SIZE) * cellPixels,
      Math.floor(index / VECTOR_GRID_SIZE) * cellPixels,
      cellPixels,
      cellPixels,
    );
  });

  context.beginPath();
  context.strokeStyle = "#333333";
  context.lineWidth = 2;
  for (let position = 1; position < VECTOR_GRID_SIZE; position += 1) {
    const pixel = position * cellPixels;
    context.moveTo(pixel, 0);
    context.lineTo(pixel, canvas.height);
    context.moveTo(0, pixel);
    context.lineTo(canvas.width, pixel);
  }
  context.stroke();
}

export function VectorAssetEditor({ snapshot, initial, authorToken, onSave, onCancel, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  initial?: MediaAsset;
  authorToken: string;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const [assetId] = useState(() => initial?.id ?? crypto.randomUUID());
  const [name, setName] = useState(initial?.name ?? "vector.svg");
  const [presentation, setPresentation] = useState<MediaAssetPresentation>(initial?.defaultPresentation ?? "inline");
  const [cells, setCells] = useState<VectorCell[]>(emptyVectorGrid);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ name: initial?.name ?? "vector.svg", presentation: initial?.defaultPresentation ?? "inline", cells: emptyVectorGrid() }));
  const [undo, setUndo] = useState<VectorCell[][]>([]);
  const [redo, setRedo] = useState<VectorCell[][]>([]);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#ffffff");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(initial));
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeStart = useRef<VectorCell[] | null>(null);
  const activePointer = useRef<number | null>(null);
  const dirty = JSON.stringify({ name, presentation, cells }) !== baseline;
  const usages = initial ? referencesTo(snapshot, "media-image", initial.id) : [];
  const hasProjectMetadata = Boolean(initial && snapshot.mediaAssets.some((asset) => asset.id === initial.id));
  const repositoryAvailable = configuredAssetContentStore.hasRepository(assetId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) renderVectorCanvas(canvas, cells);
  }, [cells]);

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
        setError("This SVG is not a 32×32 grid asset created by this editor.");
        return;
      }
      setCells(parsed);
      setBaseline(JSON.stringify({ name: initial.name, presentation: initial.defaultPresentation, cells: parsed }));
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load vector content.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initial?.id, initial?.contentKey]);

  const commit = (next: VectorCell[]) => {
    setUndo((items) => [...items.slice(-49), cells]);
    setRedo([]);
    setCells(next);
  };

  const drawAt = (x: number, y: number) => {
    setCells((current) => paintVectorCell(current, x, y, tool === "eraser" ? null : color));
  };

  const beginStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = coordinates(event.currentTarget, event.clientX, event.clientY);
    if (tool === "fill") {
      commit(floodFillVectorGrid(cells, point.x, point.y, color));
      return;
    }
    activePointer.current = event.pointerId;
    strokeStart.current = cells;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawAt(point.x, point.y);
  };

  const continueStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId || tool === "fill") return;
    event.preventDefault();
    const point = coordinates(event.currentTarget, event.clientX, event.clientY);
    drawAt(point.x, point.y);
  };

  const endStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    const before = strokeStart.current;
    strokeStart.current = null;
    setCells((current) => {
      if (before && JSON.stringify(before) !== JSON.stringify(current)) {
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
    setRedo((items) => [...items.slice(-49), cells]);
    setCells(previous);
  };

  const redoOnce = () => {
    const next = redo.at(-1);
    if (!next) return;
    setRedo((items) => items.slice(0, -1));
    setUndo((items) => [...items.slice(-49), cells]);
    setCells(next);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const svg = serializeVectorGrid(cells);
      const content = new Blob([svg], { type: "image/svg+xml" });
      const contentKey = crypto.randomUUID();
      const asset = createMediaAsset({
        id: assetId,
        name: name.trim().toLowerCase().endsWith(".svg") ? name.trim() : `${name.trim()}.svg`,
        mimeType: "image/svg+xml",
        contentKey,
        byteLength: content.size,
        intrinsicWidth: VECTOR_GRID_SIZE,
        intrinsicHeight: VECTOR_GRID_SIZE,
        defaultPresentation: presentation,
        authoringMode: "grid32",
      });
      await configuredAssetContentStore.upload(authorToken, contentKey, content);
      const result = await onSave(
        [{ type: "mediaAsset.upsert", asset }],
        `${initial ? "Changed" : "Added"} vector asset ${asset.name}`,
      );
      if (result.status === "saved" || result.status === "queued") {
        setName(asset.name);
        setBaseline(JSON.stringify({ name: asset.name, presentation, cells }));
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

  return <section className="author-panel author-panel-frame vector-asset-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>32×32 VECTOR · {name || "NEW"}</span></header>
    <div className="author-panel-body vector-editor-body">
      <p className="field-help">The grid is the editor's 32×32 coordinate surface. Saving serializes the same cell model to scalable SVG; the browser canvas is only the authoring viewport.</p>
      <div className="vector-editor-layout">
        <div className="vector-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="vector-canvas"
            width={VECTOR_CANVAS_PIXELS}
            height={VECTOR_CANVAS_PIXELS}
            role="img"
            aria-label="32 by 32 vector drawing grid"
            onPointerDown={beginStroke}
            onPointerMove={continueStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
        </div>
        <div className="vector-controls">
          <label>NAME <input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>COLOR <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
          <div className="author-actions vector-tool-row" aria-label="Drawing tools">
            {(["pencil", "eraser", "fill"] as const).map((candidate) => <button type="button" key={candidate} aria-pressed={tool === candidate} onClick={() => setTool(candidate)}>[{candidate.toUpperCase()}]</button>)}
          </div>
          <div className="author-actions vector-tool-row">
            <button type="button" disabled={!undo.length} onClick={undoOnce}>[UNDO]</button>
            <button type="button" disabled={!redo.length} onClick={redoOnce}>[REDO]</button>
            <button type="button" disabled={!cells.some(Boolean)} onClick={() => commit(emptyVectorGrid())}>[CLEAR]</button>
          </div>
          <label>DEFAULT PLAYER PRESENTATION
            <select value={presentation} onChange={(event) => setPresentation(event.target.value === "overlay" ? "overlay" : "inline")}>
              <option value="inline">inline / icon</option>
              <option value="overlay">large art / overlay</option>
            </select>
          </label>
          <small>{cells.filter(Boolean).length} / 1024 cells used · saved output remains SVG at every player zoom level.</small>
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
