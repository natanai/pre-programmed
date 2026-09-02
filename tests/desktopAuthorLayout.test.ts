import { describe, expect, it } from "vitest";
import {
  authorDesktopGapPx,
  authorDesktopWidthBounds,
  clampAuthorDesktopWidth,
  defaultAuthorDesktopWidth,
} from "../src/author/desktopLayout";

describe("desktop Author layout", () => {
  it("keeps defaults and stored preferences inside usable bounds without freezing provisional dimensions", () => {
    for (const viewportWidth of [1000, 1280, 1440, 1920, 2560]) {
      const bounds = authorDesktopWidthBounds(viewportWidth);
      const gap = authorDesktopGapPx(viewportWidth);
      const defaultWidth = defaultAuthorDesktopWidth(viewportWidth);
      expect(defaultWidth).toBeGreaterThanOrEqual(bounds.minimum);
      expect(defaultWidth).toBeLessThanOrEqual(bounds.maximum);
      expect(clampAuthorDesktopWidth(0, viewportWidth)).toBe(bounds.minimum);
      expect(clampAuthorDesktopWidth(Number.MAX_SAFE_INTEGER, viewportWidth)).toBe(bounds.maximum);
      expect(viewportWidth - bounds.maximum - gap).toBeGreaterThanOrEqual(28 * 16);
    }
  });
});
