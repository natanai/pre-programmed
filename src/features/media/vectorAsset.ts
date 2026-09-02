export const VECTOR_GRID_SIZE = 32;
export type VectorCell = string | null;

const COLOR = /^#[0-9a-f]{6}$/i;

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

export function parseVectorGrid(svgText: string): VectorCell[] | null {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, "image/svg+xml");
  if (document.querySelector("parsererror")) return null;
  const svg = document.documentElement;
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0 || viewBox[2] !== VECTOR_GRID_SIZE || viewBox[3] !== VECTOR_GRID_SIZE) return null;
  const cells = emptyVectorGrid();
  for (const element of Array.from(svg.children)) {
    if (element.tagName.toLowerCase() !== "rect") return null;
    const x = Number(element.getAttribute("x"));
    const y = Number(element.getAttribute("y"));
    const width = Number(element.getAttribute("width"));
    const height = Number(element.getAttribute("height"));
    const fill = element.getAttribute("fill") ?? "";
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(width) || !Number.isInteger(height)
      || x < 0 || y < 0 || width < 1 || height < 1 || x + width > VECTOR_GRID_SIZE || y + height > VECTOR_GRID_SIZE
      || !COLOR.test(fill)) return null;
    for (let cy = y; cy < y + height; cy += 1) {
      for (let cx = x; cx < x + width; cx += 1) cells[vectorCellIndex(cx, cy)] = fill.toLowerCase();
    }
  }
  return cells;
}
