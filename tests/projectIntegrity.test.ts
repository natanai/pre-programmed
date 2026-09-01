import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "../src/game/model";
import { interaction, project } from "./fixtures";
import { validateNewInventoryReferences } from "../worker/features/inventoryIntegrity";

function item(id: string): ItemDefinition {
  return {
    id,
    key: id,
    name: id,
    description: "",
    assetPath: "",
    width: 1,
    height: 1,
    stackable: false,
    maxStack: 1,
    removable: true,
    startingQuantity: 0,
    interactable: true,
    operations: ["inspect"],
    equipmentSlotKeys: [],
    tags: [],
    initialState: {},
    hooks: [],
  };
}

function giveItemInteraction(itemId: string) {
  const value = interaction("choose-cyber", "a", null);
  value.outcomes[0].effects = [{ id: "give-cyber-leg", type: "give_item", itemId, quantity: 1 }];
  return value;
}

describe("project reference integrity", () => {
  it("rejects a newly introduced item effect whose item is not durable", () => {
    const before = project();
    const after = project({ interactions: [giveItemInteraction("cyber-leg")] });

    expect(validateNewInventoryReferences(before, after)).toContain("has not been saved");
  });

  it("accepts the effect when the item is present in the same projected mutation", () => {
    const before = project();
    const after = project({
      items: [item("cyber-leg")],
      interactions: [giveItemInteraction("cyber-leg")],
    });

    expect(validateNewInventoryReferences(before, after)).toBeNull();
  });

  it("allows unrelated edits while an older dangling reference awaits repair", () => {
    const broken = project({ interactions: [giveItemInteraction("cyber-leg")] });
    const unrelated = structuredClone(broken);
    unrelated.nodes[0].text = "Edited without adding another broken reference.";

    expect(validateNewInventoryReferences(broken, unrelated)).toBeNull();
  });
});
