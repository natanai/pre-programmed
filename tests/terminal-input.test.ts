import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("terminal input touch target", () => {
  it("keeps the native input over the complete prompt instead of disabling pointer input", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const rule = css.match(/\.terminal-input\s*\{([^}]+)\}/)?.[1] ?? "";

    expect(rule).toContain("inset: 0");
    expect(rule).toContain("width: 100%");
    expect(rule).toContain("height: 100%");
    expect(rule).toContain("pointer-events: auto");
    expect(rule).not.toContain("pointer-events: none");
  });
});
