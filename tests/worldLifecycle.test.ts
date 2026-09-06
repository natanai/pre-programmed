import { describe, expect, it } from "vitest";
import { applyOperations } from "../src/engine/project/mutations";
import { referencesTo } from "../src/author/references/projectReferences";
import { interaction, node, project } from "./fixtures";

const poiyo = {
  id: "poiyo",
  key: "poiyo",
  type: "character" as const,
  name: "Poiyo",
  description: "A small friend.",
  tags: [],
  portraitAssetId: "portrait-poiyo",
  interactable: true,
  operations: ["inspect"],
  hooks: [],
};

const courtyard = {
  id: "courtyard",
  key: "courtyard",
  type: "location" as const,
  name: "Courtyard",
  description: "An open courtyard.",
  tags: [],
  portraitAssetId: null,
  interactable: false,
  operations: [],
  hooks: [],
};

describe("World resource lifecycle", () => {
  it("removes only the requested entity through the World mutation contract", () => {
    const snapshot = project({ entities: [poiyo, courtyard] });
    const next = applyOperations(snapshot, [{ type: "entity.delete", id: "poiyo" }]);

    expect(next.entities.map((entity) => entity.id)).toEqual(["courtyard"]);
    expect(snapshot.entities.map((entity) => entity.id)).toEqual(["poiyo", "courtyard"]);
  });

  it("finds Character and Location usages that must block deletion", () => {
    const conversationNode = {
      ...node("a", 1),
      locationMode: "set" as const,
      locationId: "courtyard",
      conversationMode: "set" as const,
      conversationCharacterId: "poiyo",
    };
    const response = interaction("greet", "a", null);
    response.outcomes[0] = { ...response.outcomes[0], speakerId: "poiyo" };

    const snapshot = project({
      nodes: [conversationNode],
      interactions: [response],
      entities: [poiyo, courtyard],
    });

    expect(referencesTo(snapshot, "character", "poiyo").map((reference) => reference.detail)).toEqual(
      expect.arrayContaining(["node conversation character", "speaker for default"]),
    );
    expect(referencesTo(snapshot, "location", "courtyard").map((reference) => reference.detail)).toContain("node location");
  });
});
