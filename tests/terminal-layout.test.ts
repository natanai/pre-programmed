import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("terminal present-moment layout", () => {
  it("keeps the prompt anchored at the vertical midpoint and the transcript independently scrollable", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const prompt = css.match(/\.prompt-line\s*\{([^}]+)\}/)?.[1] ?? "";
    const history = css.match(/\.terminal-history\s*\{([^}]+)\}/)?.[1] ?? "";
    const terminal = css.match(/\.dos-terminal\s*\{([^}]+)\}/)?.[1] ?? "";

    expect(prompt).toContain("position: absolute");
    expect(prompt).toContain("top: 50%");
    expect(prompt).toContain("transform: translateY(-50%)");
    expect(history).toContain("bottom: 50%");
    expect(history).toContain("overflow-y: auto");
    expect(terminal).toContain("margin: 0");
  });

  it("preserves deliberate history scrolling and follows the mobile visual viewport", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

    expect(app).toContain("historyPinnedToPresentRef");
    expect(app).toContain("distanceFromPresent <= 24");
    expect(app).toContain("window.visualViewport");
    expect(app).toContain("--terminal-viewport-height");
    expect(app).toContain("terminal-history-content");
  });
});
