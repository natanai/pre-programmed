import { describe, expect, it } from "vitest";
import {
  authorDesktopGapPx,
  authorDesktopWidthBounds,
  clampAuthorDesktopWidth,
  defaultAuthorDesktopWidth,
} from "../src/author/desktopLayout";

describe("desktop Author layout", () => {
  it("keeps the existing 28vw desktop width as the default within its old clamp", () => {
    expect(defaultAuthorDesktopWidth(1440)).toBeCloseTo(403.2);
    expect(defaultAuthorDesktopWidth(1920)).toBe(480);
    expect(defaultAuthorDesktopWidth(1000)).toBe(352);
  });

  it("reserves a viable game surface when the Author suite is widened", () => {
    const viewportWidth = 1000;
    const gap = authorDesktopGapPx(viewportWidth);
    const bounds = authorDesktopWidthBounds(viewportWidth);
    expect(viewportWidth - bounds.maximum - gap).toBeCloseTo(28 * 16);
  });

  it("caps the suite at sixty percent of wide desktop viewports", () => {
    const bounds = authorDesktopWidthBounds(1920);
    expect(bounds.maximum).toBe(1152);
    expect(clampAuthorDesktopWidth(5000, 1920)).toBe(1152);
  });

  it("never lets a stored preference shrink below the usable editor minimum", () => {
    expect(clampAuthorDesktopWidth(100, 1440)).toBe(320);
  });
});
