import { describe, expect, it } from "vitest";
import { buildSearchIndex, searchProject } from "../src/game/search";
import { createEmptyPlayState } from "../src/game/model";
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
      items: [{ id: "item", key: "lens", name: "Lens", description: "polished glass", assetPath: "", width: 1, height: 1, stackable: false, maxStack: 1, removable: true, tags: ["optical"], initialState: {}, hooks: [] }],
      interactions: [{
        id: "interaction", sourceNodeId: "b", wording: "Look around", aliases: ["look"], tags: ["observation"], notes: "author clue",
        outcomes: [{ id: "outcome", order: 0, label: "default", condition: { type: "always" }, responseText: "a hidden inscription", effects: [{ id: "give", type: "give_item", itemId: "item", quantity: 1 }], disposition: "stay", destinationNodeId: null }],
      }],
    });
    const state = createEmptyPlayState(snapshot);
    const documents = buildSearchIndex(snapshot);

    for (const query of ["hidden inscription", "Ada", "dusty shelves", "polished glass", "observation"]) {
      expect(searchProject(snapshot, documents, state, query, ["node"])[0]?.id).toBe("b");
    }
  });
});
