import { describe, expect, it } from "vitest";
import { buildProjectReferences, missingProjectReferences, referencesTo } from "../src/author/references/projectReferences";
import { project } from "./fixtures";

describe("feature-owned project references", () => {
  it("finds media references across prose cues, outcomes, and items", () => {
    const snapshot = project({
      nodes: [{ id: "a", nodeNumber: 1, text: "hello", ending: false, tags: [], characterId: null, locationId: null, performance: { charactersPerSecond: 18, cues: [{ id: "cue", type: "audio", start: 0, end: 0, value: "missing-audio" }] } }],
      interactions: [{
        id: "look", sourceNodeId: "a", wording: "look", choiceVisibility: "typed", aliases: ["look"], tags: [], notes: "",
        outcomes: [{ id: "outcome", order: 0, label: "default", authorStatus: "configured", condition: { type: "always" }, responseText: "shine", responsePerformance: { charactersPerSecond: 18, cues: [] }, effects: [{ id: "art", type: "art", assetId: "image" }], disposition: "stay", destinationNodeId: null }],
      }],
      items: [{ id: "item", key: "badge", name: "Badge", description: "", assetId: "image", width: 1, height: 1, stackable: false, maxStack: 1, removable: true, startingQuantity: 0, interactable: true, operations: [], tags: [], initialState: {}, hooks: [] }],
      mediaAssets: [{ id: "image", name: "badge.png", kind: "image", source: "embedded", dataUrl: "data:image/png;base64,AA==", mimeType: "image/png", size: 1, width: 1, height: 1 }],
    });
    expect(referencesTo(snapshot, "media-image", "image").map((reference) => reference.ownerKind).sort()).toEqual(["interaction", "item"]);
    expect(missingProjectReferences(snapshot)).toEqual(expect.arrayContaining([
      expect.objectContaining({ resourceKind: "media-audio", resourceId: "missing-audio", ownerKind: "node" }),
    ]));
    expect(buildProjectReferences(snapshot).every((reference) => Boolean(reference.ownerLabel && reference.detail))).toBe(true);
  });
});
