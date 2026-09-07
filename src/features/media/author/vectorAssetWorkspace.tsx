import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { referencesTo } from "../../../author/references/projectReferences";
import type { AuthorUiAction, AuthorUiNode } from "../../../author/ui/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { createMediaAsset } from "../assets";
import type { MediaAssetPresentation } from "../model";
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

type VectorAssetWorkspaceDraft = {
  assetId: string;
  name: string;
  presentation: MediaAssetPresentation;
  document: VectorGridDocument;
  loading: boolean;
  loadError: string;
  saving: boolean;
  saveError: string;
};

const VECTOR_CANVAS_LONG_EDGE_PIXELS = 1024;

function routeDimension(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function initialDocument(width?: number, height?: number) {
  const nextWidth = Number.isInteger(width) && Number(width) > 0 ? Number(width) : DEFAULT_VECTOR_GRID_SIZE.width;
  const nextHeight = Number.isInteger(height) && Number(height) > 0 ? Number(height) : DEFAULT_VECTOR_GRID_SIZE.height;
  return validateVectorGridSize(nextWidth, nextHeight)
    ? emptyVectorDocument()
    : emptyVectorDocument(nextWidth, nextHeight);
}

function vectorSignature(draft: VectorAssetWorkspaceDraft) {
  return JSON.stringify({
    assetId: draft.assetId,
    name: draft.name,
    presentation: draft.presentation,
    document: draft.document,
  });
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

function VectorCanvasControl({
  initial,
  document,
  loading,
  loadError,
  onDocumentChange,
  onLoaded,
  onLoadError,
}: {
  initial?: ReturnType<typeof configuredAssetStore.resolve>;
  document: VectorGridDocument;
  loading: boolean;
  loadError: string;
  onDocumentChange: (document: VectorGridDocument) => void;
  onLoaded: (document: VectorGridDocument) => void;
  onLoadError: (message: string) => void;
}) {
  const [undo, setUndo] = useState<VectorGridDocument[]>([]);
  const [redo, setRedo] = useState<VectorGridDocument[]>([]);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#ffffff");
  const [zoom, setZoom] = useState<Zoom>(1);
  const [resizeWidth, setResizeWidth] = useState(document.width);
  const [resizeHeight, setResizeHeight] = useState(document.height);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef(document);
  const strokeStart = useRef<VectorGridDocument | null>(null);
  const activePointer = useRef<number | null>(null);

  documentRef.current = document;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) renderVectorCanvas(canvas, document);
  }, [document]);

  useEffect(() => {
    setResizeWidth(document.width);
    setResizeHeight(document.height);
  }, [document.width, document.height]);

  useEffect(() => {
    if (!initial || !loading) return;
    let cancelled = false;
    void configuredAssetContentStore.fetch(initial).then(async (blob) => {
      const parsed = parseVectorGrid(await blob.text());
      if (cancelled) return;
      if (!parsed) {
        onLoadError("This SVG is not a vector-grid asset created by this editor.");
        return;
      }
      setUndo([]);
      setRedo([]);
      documentRef.current = parsed;
      onLoaded(parsed);
    }).catch((reason) => {
      if (!cancelled) onLoadError(reason instanceof Error ? reason.message : "Could not load vector content.");
    });
    return () => { cancelled = true; };
  }, [initial?.id, initial?.contentKey, loading]);

  const changeDocument = (next: VectorGridDocument) => {
    documentRef.current = next;
    onDocumentChange(next);
  };

  const commit = (next: VectorGridDocument) => {
    const current = documentRef.current;
    if (documentEqual(current, next)) return;
    setUndo((items) => [...items.slice(-49), current]);
    setRedo([]);
    changeDocument(next);
  };

  const drawAt = (x: number, y: number) => {
    changeDocument(paintVectorCell(documentRef.current, x, y, tool === "eraser" ? null : color));
  };

  const beginStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (loading || loadError) return;
    event.preventDefault();
    const current = documentRef.current;
    const point = coordinates(event.currentTarget, current, event.clientX, event.clientY);
    if (tool === "fill") {
      commit(floodFillVectorGrid(current, point.x, point.y, color));
      return;
    }
    activePointer.current = event.pointerId;
    strokeStart.current = current;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawAt(point.x, point.y);
  };

  const continueStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId || tool === "fill") return;
    event.preventDefault();
    const current = documentRef.current;
    const point = coordinates(event.currentTarget, current, event.clientX, event.clientY);
    drawAt(point.x, point.y);
  };

  const endStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    const before = strokeStart.current;
    strokeStart.current = null;
    const current = documentRef.current;
    if (before && !documentEqual(before, current)) {
      setUndo((items) => [...items.slice(-49), before]);
      setRedo([]);
    }
  };

  const undoOnce = () => {
    const previous = undo.at(-1);
    if (!previous) return;
    setUndo((items) => items.slice(0, -1));
    setRedo((items) => [...items.slice(-49), documentRef.current]);
    changeDocument(previous);
  };

  const redoOnce = () => {
    const next = redo.at(-1);
    if (!next) return;
    setRedo((items) => items.slice(0, -1));
    setUndo((items) => [...items.slice(-49), documentRef.current]);
    changeDocument(next);
  };

  const choosePreset = (width: number, height: number) => {
    setResizeWidth(width);
    setResizeHeight(height);
  };

  const sizeError = validateVectorGridSize(resizeWidth, resizeHeight);
  const applyResize = () => {
    const current = documentRef.current;
    if (sizeError || (resizeWidth === current.width && resizeHeight === current.height)) return;
    if (resizeWouldCrop(current, resizeWidth, resizeHeight)
      && !window.confirm(`Resize to ${resizeWidth}×${resizeHeight}? Painted cells outside the new canvas will be cropped.`)) return;
    commit(resizeVectorGrid(current, resizeWidth, resizeHeight));
  };

  if (loading) return <div className="author-message">LOADING VECTOR CONTENT...</div>;
  if (loadError) return <div className="author-message" role="alert">{loadError}</div>;

  const usedCells = document.cells.filter(Boolean).length;
  const stageStyle = {
    width: `${zoom * 100}%`,
    maxWidth: `${34 * zoom}rem`,
    aspectRatio: `${document.width} / ${document.height}`,
  } as CSSProperties;

  return <div className="vector-editor-layout">
    <div className="vector-drawing-column">
      <div className="vector-zoom-row" aria-label="Vector canvas zoom">
        <span>VIEW</span>
        {([1, 2, 4] as const).map((candidate) => <button
          type="button"
          key={candidate}
          aria-pressed={zoom === candidate}
          onClick={() => setZoom(candidate)}
        >[{candidate === 1 ? "FIT" : `${candidate}×`}]</button>)}
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
      <section className="vector-canvas-settings" aria-label="Vector canvas size">
        <span>CANVAS · {document.width}×{document.height} UNITS</span>
        <div className="vector-preset-row">
          {VECTOR_GRID_PRESETS.map((preset) => <button
            type="button"
            key={preset.id}
            onClick={() => choosePreset(preset.width, preset.height)}
          >[{preset.label.toUpperCase()} · {preset.width}×{preset.height}]</button>)}
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
      <small>{usedCells} / {document.width * document.height} cells used · SVG viewBox {document.width}×{document.height}.</small>
    </div>
  </div>;
}

export const vectorAssetWorkspace = defineAuthorWorkspace<VectorAssetWorkspaceDraft>({
  id: "media-vector-asset",
  matches: (route) => route.type === "feature" && route.feature === "media" && route.workspace === "vector-asset",
  createDraft: (route, context) => {
    const initial = route.data?.assetId
      ? configuredAssetStore.resolve(context.snapshot, route.data.assetId) ?? undefined
      : undefined;
    const document = initialDocument(routeDimension(route.data?.vectorWidth), routeDimension(route.data?.vectorHeight));
    return {
      assetId: initial?.id ?? crypto.randomUUID(),
      name: initial?.name ?? "vector.svg",
      presentation: initial?.defaultPresentation ?? "inline",
      document,
      loading: Boolean(initial),
      loadError: "",
      saving: false,
      saveError: "",
    };
  },
  signature: vectorSignature,
  saveLabel: "SAVE VECTOR",
  canSave: ({ draft }) => !draft.loading && !draft.loadError && !draft.saving && Boolean(draft.name.trim()),
  save: async ({ route, context, draft, setDraft }) => {
    if (draft.loading || draft.loadError || !draft.name.trim()) return { accepted: false };
    setDraft((current) => ({ ...current, saving: true, saveError: "" }));
    try {
      const svg = serializeVectorGrid(draft.document);
      const content = new Blob([svg], { type: "image/svg+xml" });
      const contentKey = crypto.randomUUID();
      const asset = createMediaAsset({
        id: draft.assetId,
        name: draft.name.trim().toLowerCase().endsWith(".svg") ? draft.name.trim() : `${draft.name.trim()}.svg`,
        mimeType: "image/svg+xml",
        contentKey,
        byteLength: content.size,
        intrinsicWidth: draft.document.width,
        intrinsicHeight: draft.document.height,
        defaultPresentation: draft.presentation,
        authoringMode: "vector-grid",
      });
      const persisted = context.snapshot.mediaAssets.some((candidate) => candidate.id === draft.assetId);
      const result = await context.persist(
        [{ type: "mediaAsset.upsert", asset, generatedContent: { mimeType: "image/svg+xml", text: svg } }],
        `${persisted ? "Changed" : "Added"} vector asset ${asset.name}`,
      );
      if (result.status !== "saved" && result.status !== "queued") {
        setDraft((current) => ({
          ...current,
          saving: false,
          saveError: result.status === "conflict"
            ? "Project changed on another device. Synchronize before saving this vector again."
            : result.message ?? "Vector save failed.",
        }));
        return { accepted: false };
      }
      const savedDraft: VectorAssetWorkspaceDraft = {
        ...draft,
        name: asset.name,
        loading: false,
        loadError: "",
        saving: false,
        saveError: "",
      };
      const resourceKind = route.data?.resourceTask;
      return {
        accepted: true,
        draft: savedDraft,
        ...(resourceKind ? {
          completion: {
            type: "resource" as const,
            kind: resourceKind,
            id: asset.id,
            value: asset.id,
            label: asset.name,
          },
        } : {}),
      };
    } catch (reason) {
      setDraft((current) => ({
        ...current,
        saving: false,
        saveError: reason instanceof Error ? reason.message : "Vector save failed.",
      }));
      return { accepted: false };
    }
  },
  buildSpec: ({ context, draft, setDraft, dirty, adoptLoadedDraft }) => {
    const initial = configuredAssetStore.resolve(context.snapshot, draft.assetId) ?? undefined;
    const usages = initial ? referencesTo(context.snapshot, "media-image", draft.assetId) : [];
    const hasProjectMetadata = context.snapshot.mediaAssets.some((asset) => asset.id === draft.assetId);
    const repositoryAvailable = configuredAssetContentStore.hasRepository(draft.assetId);

    const change = (patch: Partial<VectorAssetWorkspaceDraft>) => setDraft((current) => ({
      ...current,
      ...patch,
      saveError: "",
    }));

    const resetOrDelete = async () => {
      if (!initial || !hasProjectMetadata || draft.saving) return;
      const resetting = repositoryAvailable;
      if (!resetting && usages.length) return;
      const prompt = resetting
        ? `Reset media asset “${initial.name}” to its repository definition?`
        : `Delete media asset “${initial.name}”?`;
      if (!window.confirm(prompt)) return;
      setDraft((current) => ({ ...current, saving: true, saveError: "" }));
      const result = await context.persist(
        [{ type: "mediaAsset.delete", id: draft.assetId }],
        resetting ? `Reset media asset ${initial.name} to repository copy` : `Deleted media asset ${initial.name}`,
      );
      if (result.status === "saved" || result.status === "queued") {
        context.leaveCurrentTask();
        return;
      }
      setDraft((current) => ({
        ...current,
        saving: false,
        saveError: result.status === "conflict"
          ? "The project changed while this vector was being removed. Nothing was changed."
          : result.message ?? "Vector delete/reset failed.",
      }));
    };

    const exportAsset = async () => {
      if (dirty || draft.loading) return;
      const resolved = configuredAssetStore.resolve(context.snapshot, draft.assetId);
      if (!resolved) return;
      try {
        await configuredAssetContentStore.exportAsset(resolved);
      } catch (reason) {
        change({ saveError: reason instanceof Error ? reason.message : "Asset export failed." });
      }
    };

    const blocks: AuthorUiNode[] = [
      {
        type: "section",
        id: "vector-metadata",
        label: "Vector",
        importance: "primary",
        children: [
          {
            type: "field",
            id: "vector-name",
            label: "Name",
            value: draft.name,
            disabled: draft.loading || Boolean(draft.loadError),
            onChange: (name) => change({ name }),
          },
          {
            type: "select",
            id: "vector-presentation",
            label: "Default player presentation",
            value: draft.presentation,
            disabled: draft.loading || Boolean(draft.loadError),
            options: [
              { value: "inline", label: "inline / icon" },
              { value: "overlay", label: "large art / overlay" },
            ],
            onChange: (value) => change({ presentation: value === "overlay" ? "overlay" : "inline" }),
          },
        ],
      },
      {
        type: "custom",
        id: "vector-canvas",
        role: "specialized-control",
        content: <VectorCanvasControl
          initial={initial}
          document={draft.document}
          loading={draft.loading}
          loadError={draft.loadError}
          onDocumentChange={(document) => change({ document })}
          onLoaded={(document) => adoptLoadedDraft({
            ...draft,
            document,
            loading: false,
            loadError: "",
            saving: false,
            saveError: "",
          })}
          onLoadError={(loadError) => setDraft((current) => ({ ...current, loading: false, loadError }))}
        />,
      },
      ...(draft.saveError ? [{
        type: "status" as const,
        id: "vector-save-error",
        tone: "error" as const,
        text: draft.saveError,
      }] : []),
    ];

    const actions: AuthorUiAction[] = [];
    if (initial) actions.push({
      id: "vector-export",
      label: "EXPORT + ID",
      disabled: draft.saving || draft.loading || dirty,
      onAction: () => { void exportAsset(); },
    });
    if (initial && hasProjectMetadata) actions.push({
      id: "vector-lifecycle",
      label: `${repositoryAvailable ? "RESET TO REPOSITORY" : "DELETE"}${!repositoryAvailable && usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}`,
      tone: "danger",
      disabled: draft.saving || (!repositoryAvailable && usages.length > 0),
      onAction: () => { void resetOrDelete(); },
    });

    return {
      id: "media-vector-asset",
      title: `Vector · ${draft.name || "New"}`,
      context: `${draft.document.width}×${draft.document.height} · ${draft.document.cells.filter(Boolean).length} cells`,
      blocks,
      actions,
    };
  },
});
