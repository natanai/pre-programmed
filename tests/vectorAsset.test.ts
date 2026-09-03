import { describe, expect, it } from "vitest";
import {
  VECTOR_GRID_MAX_CELLS,
  emptyVectorDocument,
  floodFillVectorGrid,
  paintVectorCell,
  parseVectorGrid,
  resizeVectorGrid,
  resizeWouldCrop,
  serializeVectorGrid,
  validateVectorGridSize,
  vectorCellIndex,
} from "../src/features/media/vectorAsset";

describe("Media vector-grid documents", () => {
  it("round-trips the 32×32 sprite preset without special-case parsing", () => {
    let document = emptyVectorDocument(32, 32);
    document = paintVectorCell(document, 2, 3, "#abcdef");
    const parsed = parseVectorGrid(serializeVectorGrid(document));

    expect(parsed).toEqual(document);
  });

  it("round-trips a rectangular 48×64 portrait", () => {
    let document = emptyVectorDocument(48, 64);
    document = paintVectorCell(document, 47, 63, "#123456");
    document = paintVectorCell(document, 0, 0, "#fedcba");

    const svg = serializeVectorGrid(document);
    expect(svg).toContain('viewBox="0 0 48 64"');
    expect(parseVectorGrid(svg)).toEqual(document);
  });

  it("flood fill respects rectangular boundaries", () => {
    let document = emptyVectorDocument(3, 5);
    for (let y = 0; y < 5; y += 1) document = paintVectorCell(document, 1, y, "#ffffff");
    document = floodFillVectorGrid(document, 0, 4, "#ff0000");

    expect(document.cells[vectorCellIndex(document, 0, 0)]).toBe("#ff0000");
    expect(document.cells[vectorCellIndex(document, 0, 4)]).toBe("#ff0000");
    expect(document.cells[vectorCellIndex(document, 1, 4)]).toBe("#ffffff");
    expect(document.cells[vectorCellIndex(document, 2, 4)]).toBeNull();
  });

  it("resizes without resampling and reports destructive crops", () => {
    let document = emptyVectorDocument(4, 4);
    document = paintVectorCell(document, 1, 1, "#111111");
    document = paintVectorCell(document, 3, 3, "#222222");

    expect(resizeWouldCrop(document, 3, 3)).toBe(true);
    const smaller = resizeVectorGrid(document, 3, 3);
    expect(smaller.cells[vectorCellIndex(smaller, 1, 1)]).toBe("#111111");
    expect(smaller.cells).not.toContain("#222222");

    const larger = resizeVectorGrid(smaller, 6, 5);
    expect(larger.cells[vectorCellIndex(larger, 1, 1)]).toBe("#111111");
    expect(larger.cells[vectorCellIndex(larger, 5, 4)]).toBeNull();
  });

  it("enforces one configurable logical-cell cap", () => {
    expect(validateVectorGridSize(128, 128)).toBeNull();
    expect(128 * 128).toBe(VECTOR_GRID_MAX_CELLS);
    expect(validateVectorGridSize(129, 128)).toContain("at most");
    expect(parseVectorGrid('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 129 128" shape-rendering="crispEdges"></svg>')).toBeNull();
  });
});
