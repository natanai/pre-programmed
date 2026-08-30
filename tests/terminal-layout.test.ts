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
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

    expect(app).toContain("historyPinnedToPresentRef");
    expect(app).toContain("distanceFromPresent <= 24");
    expect(app).toContain("window.visualViewport");
    expect(app).toContain("--terminal-viewport-height");
    expect(app).toContain("--terminal-viewport-top");
    expect(app).toContain("root.dataset.keyboardOpen");
    expect(app).toContain("terminal-history-content");
    expect(html).toContain("interactive-widget=resizes-content");
  });

  it("keeps dialogue authoring beside the live prompt and avoids decorative choice chrome", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const choiceButton = css.match(/\.player-choice-surface button\s*\{([^}]+)\}/)?.[1] ?? "";

    expect(app).toContain("dialogueAuthoring");
    expect(app).toContain("dialogue-authoring-popover");
    expect(app).not.toContain("prompt-choice-caret");
    expect(choiceButton).toContain("border: 0");
    expect(choiceButton).toContain("text-align: left");
    for (const accent of ["#6cf", "#9cf", "#9f9", "#fc6", "#123", "#345"]) expect(css).not.toContain(accent);
  });

  it("does not restart an unchanged opening when the network snapshot replaces its cache", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    expect(app).toContain("const performanceKey = JSON.stringify(performance)");
    expect(app).toContain("[text, performanceKey]");
  });

  it("gives keyboard-open dialogue more room while preserving a fixed editing frame", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(css).toContain("html[data-keyboard-open=\"true\"] .dialogue-authoring-active .terminal-history");
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(css).toContain(".author-panel-body");
    expect(css).toContain(".author-panel-footer");
    expect(css).toContain("font-size: max(16px, 1em)");
  });
});
