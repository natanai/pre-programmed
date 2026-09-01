import { describe, expect, it } from "vitest";
import { authorOperationDefinitions } from "../src/author/operations/catalog";
import type { CommandDefinition } from "../src/features/commands/model";
import { project } from "./fixtures";

function targetedCommand(
  id: string,
  label: string,
  operation: string,
  sourceKind: string,
): CommandDefinition {
  return {
    id,
    label,
    operation,
    enabled: true,
    patterns: [`${operation} {target}`],
    slots: [{ name: "target", sourceKind }],
    targetSlot: "target",
  };
}

describe("author operation target scopes", () => {
  const snapshot = project();
  snapshot.settings.commands.commands = [
    {
      id: "inventory-open",
      label: "Inventory",
      operation: "inventory.open",
      enabled: true,
      patterns: ["inventory"],
      slots: [],
      targetSlot: "",
    },
    targetedCommand("polish-item", "Polish", "polish", "inventory.item"),
    targetedCommand("greet-character", "Greet", "greet", "world.character"),
    targetedCommand("visit-location", "Visit", "visit", "world.location"),
    targetedCommand("adjust-variable", "Adjust", "adjust", "state.variable"),
  ];

  it("keeps targetless application commands out of target editors", () => {
    for (const targetKind of ["inventory.item", "world.character", "world.location", "state.variable"]) {
      expect(authorOperationDefinitions(snapshot, targetKind).map((definition) => definition.value))
        .not.toContain("inventory.open");
    }
  });

  it("includes built-in item operations and item-targeted authored commands", () => {
    expect(authorOperationDefinitions(snapshot, "inventory.item").map((definition) => definition.value))
      .toEqual(["inspect", "use", "move", "remove", "equip", "unequip", "polish"]);
  });

  it("keeps commands within their exact semantic author target", () => {
    expect(authorOperationDefinitions(snapshot, "world.character").map((definition) => definition.value))
      .toEqual(["greet"]);
    expect(authorOperationDefinitions(snapshot, "world.location").map((definition) => definition.value))
      .toEqual(["visit"]);
    expect(authorOperationDefinitions(snapshot, "state.variable").map((definition) => definition.value))
      .toEqual(["adjust"]);
    expect(authorOperationDefinitions(snapshot, "state.computed")).toEqual([]);
  });
});
