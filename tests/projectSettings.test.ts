import { describe, expect, it } from "vitest";
import { normalizeProjectSettings } from "../src/engine/project/settings";

describe("project settings normalization", () => {
  it("preserves an explicitly empty authored Commands configuration", () => {
    const settings = normalizeProjectSettings({
      terminalPrompt: ">",
      commands: { referenceSources: [], commands: [] },
    });
    expect(settings.commands).toEqual({ referenceSources: [], commands: [] });
  });
});
