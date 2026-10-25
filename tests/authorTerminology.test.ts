import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { buildAuthorToolGroups } from "../src/author/tools/registry";
import { worldAuthorFeature } from "../src/features/world/author/manifest";
import { project } from "./fixtures";

describe("Author terminology contracts", () => {
  it("advertises exactly the two World resource editors it exposes", () => {
    const resources = worldAuthorFeature.resources ?? [];
    expect(resources.map((resource) => resource.label)).toEqual(["Character", "Location"]);
    const snapshot = project();
    const groups = buildAuthorToolGroups({
      snapshot,
      playState: createEmptyPlayState(snapshot),
      pushTask: () => "task",
      closeAll: () => undefined,
      downloadBackup: async () => undefined,
    });
    const tools = groups.flatMap((group) => group.tools);
    const world = tools.find((tool) => tool.id === "people-places");
    expect(world?.description).toBe("Create and edit Characters and Locations.");
    expect(world?.description.toLowerCase()).not.toContain("speakers");
    expect(world?.description.toLowerCase()).not.toContain("world entities");
    expect(tools.find((tool) => tool.id === "structure")?.description).toContain("entry responses");
    expect(tools.find((tool) => tool.id === "state-definitions")?.description).toContain("Flags");
  });
});
