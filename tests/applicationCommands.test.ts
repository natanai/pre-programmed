import { describe, expect, it } from "vitest";
import { APPLICATION_COMMAND_CAPABILITY_BY_OPERATION } from "../src/features/commands/applicationCatalog";
import { DEFAULT_COMMAND_PROJECT_SETTINGS } from "../src/features/commands/defaultCatalog";

describe("application command capabilities", () => {
  it("keeps Inventory capability vocabulary separate from player grammar", () => {
    const capability = APPLICATION_COMMAND_CAPABILITY_BY_OPERATION["inventory.open"];
    expect(capability).toMatchObject({
      operation: "inventory.open",
      action: { type: "open-workspace", feature: "inventory", workspace: "inventory" },
    });

    const starter = DEFAULT_COMMAND_PROJECT_SETTINGS.commands.find((command) => command.operation === "inventory.open");
    expect(starter?.patterns).toEqual(["inventory", "inv"]);
    expect(capability).not.toHaveProperty("patterns");
    expect(capability).not.toHaveProperty("aliases");
  });
});
