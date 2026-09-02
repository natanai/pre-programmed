import { describe, expect, it, vi } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { buildSearchIndex, searchProject } from "../src/author/search/projectSearch";
import { buildAuthorSearchEntries, searchAuthorEntries } from "../src/author/search/authorSearch";
import { buildAuthorToolGroups } from "../src/author/tools/registry";
import { project } from "./fixtures";

describe("local author destination search", () => {
  it("finds nodes through linked response, character, location, item, and tag context", () => {
    const snapshot = project({
      nodes: [
        { id: "a", nodeNumber: 1, text: "origin", ending: false, tags: [], characterId: null, locationId: null, performance: { charactersPerSecond: 18, cues: [] } },
        { id: "b", nodeNumber: 2, text: "quiet room", ending: false, tags: ["blue"], characterId: "character", locationId: "location", performance: { charactersPerSecond: 18, cues: [] } },
      ],
      entities: [
        { id: "character", key: "guide", type: "character", name: "Ada", description: "helpful speaker", tags: ["mentor"] },
        { id: "location", key: "archive", type: "location", name: "Archive", description: "dusty shelves", tags: ["library"] },
      ],
      items: [{ id: "item", key: "lens", name: "Lens", description: "polished glass", assetId: "", width: 1, height: 1, stackable: false, maxStack: 1, removable: true, startingQuantity: 0, interactable: true, operations: ["inspect", "use", "move", "remove"], tags: ["optical"], initialState: {}, hooks: [] }],
      interactions: [{
        id: "interaction", sourceNodeId: "b", wording: "Look around", choiceVisibility: "prompt", aliases: ["look"], tags: ["observation"], notes: "author clue",
        outcomes: [{ id: "outcome", order: 0, label: "default", authorStatus: "configured", condition: { type: "always" }, responseText: "a hidden inscription", effects: [{ id: "give", type: "give_item", itemId: "item", quantity: 1 }], disposition: "stay", destinationNodeId: null }],
      }],
    });
    const state = createEmptyPlayState(snapshot);
    const documents = buildSearchIndex(snapshot);

    for (const query of ["hidden inscription", "Ada", "dusty shelves", "polished glass", "observation"]) {
      expect(searchProject(snapshot, documents, state, query, ["node"])[0]?.id).toBe("b");
    }
  });

  it("finds nested Author controls and concepts rather than only visible home cards", () => {
    const snapshot = project({
      items: [{ id: "cyber-leg", key: "cyber-leg", name: "Cyber Leg", description: "replacement limb", assetId: "", width: 1, height: 2, stackable: false, maxStack: 1, removable: true, startingQuantity: 0, interactable: true, operations: ["inspect"], equipmentSlotKeys: ["leg"], tags: [], initialState: {}, hooks: [] }],
    });
    const playState = createEmptyPlayState(snapshot);
    const pushTask = vi.fn(() => "task");
    const context = { snapshot, playState, pushTask, closeAll: vi.fn(), downloadBackup: vi.fn() };
    const groups = buildAuthorToolGroups(context);
    const entries = buildAuthorSearchEntries(context, groups);

    expect(searchAuthorEntries(entries, "label").map((entry) => entry.label)).toEqual(expect.arrayContaining([
      "INPUT RESPONSES + OUTCOME LABELS",
      "PLAYER COMMANDS + LABELS",
    ]));
    expect(searchAuthorEntries(entries, "rule").map((entry) => entry.label)).toEqual(expect.arrayContaining([
      "NODE TEXT + TEXT RULES",
      "ITEMS + EQUIPMENT RULES",
    ]));
    expect(searchAuthorEntries(entries, "cyber leg")[0]?.label).toBe("Cyber Leg");
  });
});
