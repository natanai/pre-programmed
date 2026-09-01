import { describe, expect, it } from "vitest";
import { normalizeProjectSettings } from "../src/engine/project/settings";

describe("project settings command defaults", () => {
  it("materializes feature starter grammar for projects that predate Commands", () => {
    const settings = normalizeProjectSettings({ terminalPrompt: "U:\\>" });
    expect(settings.commands.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "inventory.open", patterns: ["inventory", "inv"] }),
    ]));
  });

  it("preserves an explicitly empty authored Commands configuration", () => {
    const settings = normalizeProjectSettings({
      terminalPrompt: ">",
      commands: { referenceSources: [], commands: [] },
    });
    expect(settings.commands).toEqual({ referenceSources: [], commands: [] });
  });
});
