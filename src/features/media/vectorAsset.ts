export type VectorCell = string | null;

export type VectorGridDocument = {
  width: number;
  height: number;
  cells: VectorCell[];
};

export type VectorGridPreset = {
  id: "sprite" | "portrait";
  label: string;
  width: number;
  height: number;
};

export const VECTOR_GRID_PRESETS: readonly VectorGridPreset[] = [
  { id: "sprite", label: "Square / Sprite", width: 32, height: 32 },
  { id: "portrait", label: "Portrait", width: 48, height: 64 },
];

export const DEFAULT_VECTOR_GRID_SIZE = { width: 32, height: 32 } as const;
export const VECTOR_GRID_MAX_CELLS = 16_384;

const COLOR = /^#[0-9a-f]{6}$/i;
const ATTRIBUTE = /\s+([A-Za-z_:][A-Za-z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gy;

function validDimension(value: number) {
  return Number.isInteger(value) && value > 0;
}

export function validateVectorGridSize(width: number, height: number) {
  if (!validDimension(width) || !validDimension(height)) return "Vector canvas dimensions must be positive whole numbers.";
  if (width * height > VECTOR_GRID_MAX_CELLS) return `Vector canvases may contain at most ${VECTOR_GRID_MAX_CELLS} cells.`;
  return null;
}

export function emptyVectorDocument(
  width: number = DEFAULT_VECTOR_GRID_SIZE.width,
  height: number = DEFAULT_VECTOR_GRID_SIZE.height,
): VectorGridDocument {
  const error = validateVectorGridSize(width, height);
  if (error) throw new Error(error);
  return { width, height, cells: Array.from({ length: width * height }, () => null) };
}

export function vectorCellIndex(document: Pick<VectorGridDocument, "width">, x: number, y: number) {
  return y * document.width + x;
}

function inside(document: Pick<VectorGridDocument, "width" | "height">, x: number, y: number) {
  return x >= 0 && y >= 0 && x < document.width && y < document.height;
}

function withCells(document: VectorGridDocument, cells: VectorCell[]): VectorGridDocument {
  return { ...document, cells };
}

export function paintVectorCell(document: VectorGridDocument, x: number, y: number, color: string | null) {
  if (!inside(document, x, y)) return { ...document, cells: [...document.cells] };
  if (color !== null && !COLOR.test(color)) throw new Error("Vector cell color must be a six-digit hex color.");
  const cells = [...document.cells];
  cells[vectorCellIndex(document, x, y)] = color?.toLowerCase() ?? null;
  return withCells(document, cells);
}

export function floodFillVectorGrid(document: VectorGridDocument, x: number, y: number, color: string | null) {
  if (!inside(document, x, y)) return { ...document, cells: [...document.cells] };
  if (color !== null && !COLOR.test(color)) throw new Error("Vector fill color must be a six-digit hex color.");
  const replacement = color?.toLowerCase() ?? null;
  const target = document.cells[vectorCellIndex(document, x, y)] ?? null;
  if (target === replacement) return { ...document, cells: [...document.cells] };
  const cells = [...document.cells];
  const queue: Array<[number, number]> = [[x, y]];
  while (queue.length) {
    const [cx, cy] = queue.pop()!;
    const index = vectorCellIndex(document, cx, cy);
    if ((cells[index] ?? null) !== target) continue;
    cells[index] = replacement;
    if (cx > 0) queue.push([cx - 1, cy]);
    if (cx + 1 < document.width) queue.push([cx + 1, cy]);
    if (cy > 0) queue.push([cx, cy - 1]);
    if (cy + 1 < document.height) queue.push([cx, cy + 1]);
  }
  return withCells(document, cells);
}

export function resizeVectorGrid(document: VectorGridDocument, width: number, height: number) {
  const error = validateVectorGridSize(width, height);
  if (error) throw new Error(error);
  const next = emptyVectorDocument(width, height);
  const copyWidth = Math.min(document.width, width);
  const copyHeight = Math.min(document.height, height);
  for (let y = 0; y < copyHeight; y += 1) {
    for (let x = 0; x < copyWidth; x += 1) {
      next.cells[vectorCellIndex(next, x, y)] = document.cells[vectorCellIndex(document, x, y)] ?? null;
    }
  }
  return next;
}

export function resizeWouldCrop(document: VectorGridDocument, width: number, height: number) {
  if (width >= document.width && height >= document.height) return false;
  return document.cells.some((cell, index) => {
    if (!cell) return false;
    const x = index % document.width;
    const y = Math.floor(index / document.width);
    return x >= width || y >= height;
  });
}

export function serializeVectorGrid(document: VectorGridDocument) {
  const error = validateVectorGridSize(document.width, document.height);
  if (error) throw new Error(error);
  if (document.cells.length !== document.width * document.height) throw new Error("Vector grid cell count does not match its canvas dimensions.");
  const rectangles: string[] = [];
  for (let y = 0; y < document.height; y += 1) {
    let x = 0;
    while (x < document.width) {
      const color = document.cells[vectorCellIndex(document, x, y)];
      if (!color) { x += 1; continue; }
      if (!COLOR.test(color)) throw new Error("Vector grid contains an invalid color.");
      let width = 1;
      while (x + width < document.width && document.cells[vectorCellIndex(document, x + width, y)] === color) width += 1;
      rectangles.push(`<rect x="${x}" y="${y}" width="${width}" height="1" fill="${color.toLowerCase()}"/>`);
      x += width;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${document.width} ${document.height}" shape-rendering="crispEdges">`,
    ...rectangles,
    "</svg>",
  ].join("");
}

function parseAttributes(source: string) {
  const attributes = new Map<string, string>();
  let position = 0;
  while (position < source.length) {
    if (!source.slice(position).trim()) break;
    ATTRIBUTE.lastIndex = position;
    const match = ATTRIBUTE.exec(source);
    if (!match) return null;
    const name = match[1];
    if (attributes.has(name)) return null;
    attributes.set(name, match[2] ?? match[3] ?? "");
    position = ATTRIBUTE.lastIndex;
  }
  return attributes;
}

/**
 * Parse only the deterministic SVG subset emitted by serializeVectorGrid.
 * The model is shared by browser and non-DOM verification runtimes, so it
 * deliberately does not depend on DOMParser or a browser repair parser.
 */
export function parseVectorGrid(svgText: string): VectorGridDocument | null {
  const root = svgText.match(/^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
  if (!root) return null;
  const rootAttributes = parseAttributes(root[1]);
  if (!rootAttributes) return null;
  const viewBox = rootAttributes.get("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0) return null;
  const width = viewBox[2];
  const height = viewBox[3];
  if (validateVectorGridSize(width, height)) return null;

  const document = emptyVectorDocument(width, height);
  const body = root[2];
  const rectangle = /\s*<rect\b([^>]*)\/>\s*/gy;
  let position = 0;
  while (position < body.length) {
    if (!body.slice(position).trim()) break;
    rectangle.lastIndex = position;
    const match = rectangle.exec(body);
    if (!match) return null;
    position = rectangle.lastIndex;

    const attributes = parseAttributes(match[1]);
    if (!attributes || attributes.size !== 5) return null;
    if (!["x", "y", "width", "height", "fill"].every((name) => attributes.has(name))) return null;
    const x = Number(attributes.get("x"));
    const y = Number(attributes.get("y"));
    const rectWidth = Number(attributes.get("width"));
    const rectHeight = Number(attributes.get("height"));
    const fill = attributes.get("fill") ?? "";
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(rectWidth) || !Number.isInteger(rectHeight)
      || x < 0 || y < 0 || rectWidth < 1 || rectHeight < 1 || x + rectWidth > width || y + rectHeight > height
      || !COLOR.test(fill)) return null;
    for (let cy = y; cy < y + rectHeight; cy += 1) {
      for (let cx = x; cx < x + rectWidth; cx += 1) document.cells[vectorCellIndex(document, cx, cy)] = fill.toLowerCase();
    }
  }
  return document;
}
