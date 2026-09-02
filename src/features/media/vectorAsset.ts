export const VECTOR_GRID_SIZE = 32;
export type VectorCell = string | null;

const COLOR = /^#[0-9a-f]{6}$/i;
const ATTRIBUTE = /\s+([A-Za-z_:][A-Za-z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gy;

export function emptyVectorGrid(): VectorCell[] {
  return Array.from({ length: VECTOR_GRID_SIZE * VECTOR_GRID_SIZE }, () => null);
}

export function vectorCellIndex(x: number, y: number) {
  return y * VECTOR_GRID_SIZE + x;
}

export function paintVectorCell(cells: readonly VectorCell[], x: number, y: number, color: string | null) {
  if (x < 0 || y < 0 || x >= VECTOR_GRID_SIZE || y >= VECTOR_GRID_SIZE) return [...cells];
  if (color !== null && !COLOR.test(color)) throw new Error("Vector cell color must be a six-digit hex color.");
  const next = [...cells];
  next[vectorCellIndex(x, y)] = color?.toLowerCase() ?? null;
  return next;
}

export function floodFillVectorGrid(cells: readonly VectorCell[], x: number, y: number, color: string | null) {
  if (x < 0 || y < 0 || x >= VECTOR_GRID_SIZE || y >= VECTOR_GRID_SIZE) return [...cells];
  if (color !== null && !COLOR.test(color)) throw new Error("Vector fill color must be a six-digit hex color.");
  const replacement = color?.toLowerCase() ?? null;
  const target = cells[vectorCellIndex(x, y)] ?? null;
  if (target === replacement) return [...cells];
  const next = [...cells];
  const queue: Array<[number, number]> = [[x, y]];
  while (queue.length) {
    const [cx, cy] = queue.pop()!;
    const index = vectorCellIndex(cx, cy);
    if ((next[index] ?? null) !== target) continue;
    next[index] = replacement;
    if (cx > 0) queue.push([cx - 1, cy]);
    if (cx + 1 < VECTOR_GRID_SIZE) queue.push([cx + 1, cy]);
    if (cy > 0) queue.push([cx, cy - 1]);
    if (cy + 1 < VECTOR_GRID_SIZE) queue.push([cx, cy + 1]);
  }
  return next;
}

export function serializeVectorGrid(cells: readonly VectorCell[]) {
  if (cells.length !== VECTOR_GRID_SIZE * VECTOR_GRID_SIZE) throw new Error("Vector grid must contain exactly 1024 cells.");
  const rectangles: string[] = [];
  for (let y = 0; y < VECTOR_GRID_SIZE; y += 1) {
    let x = 0;
    while (x < VECTOR_GRID_SIZE) {
      const color = cells[vectorCellIndex(x, y)];
      if (!color) { x += 1; continue; }
      if (!COLOR.test(color)) throw new Error("Vector grid contains an invalid color.");
      let width = 1;
      while (x + width < VECTOR_GRID_SIZE && cells[vectorCellIndex(x + width, y)] === color) width += 1;
      rectangles.push(`<rect x="${x}" y="${y}" width="${width}" height="1" fill="${color.toLowerCase()}"/>`);
      x += width;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VECTOR_GRID_SIZE} ${VECTOR_GRID_SIZE}" shape-rendering="crispEdges">`,
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
 * Parse only the small deterministic SVG subset emitted by serializeVectorGrid.
 * This feature model is shared by browser and non-DOM verification runtimes, so
 * it deliberately does not depend on DOMParser or a browser repair parser.
 */
export function parseVectorGrid(svgText: string): VectorCell[] | null {
  const root = svgText.match(/^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
  if (!root) return null;
  const rootAttributes = parseAttributes(root[1]);
  if (!rootAttributes) return null;
  const viewBox = rootAttributes.get("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0 || viewBox[2] !== VECTOR_GRID_SIZE || viewBox[3] !== VECTOR_GRID_SIZE) return null;

  const cells = emptyVectorGrid();
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
    const width = Number(attributes.get("width"));
    const height = Number(attributes.get("height"));
    const fill = attributes.get("fill") ?? "";
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(width) || !Number.isInteger(height)
      || x < 0 || y < 0 || width < 1 || height < 1 || x + width > VECTOR_GRID_SIZE || y + height > VECTOR_GRID_SIZE
      || !COLOR.test(fill)) return null;
    for (let cy = y; cy < y + height; cy += 1) {
      for (let cx = x; cx < x + width; cx += 1) cells[vectorCellIndex(cx, cy)] = fill.toLowerCase();
    }
  }
  return cells;
}
