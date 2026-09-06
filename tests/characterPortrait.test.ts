import { describe, expect, it } from "vitest";
import { worldProjectReferences } from "../src/features/world/author/references";
import { project } from "./fixtures";

describe("character portraits", () => {
  it("tracks a portrait as a Media image reference owned by its Character", () => {
    const snapshot = project({
      entities: [{
        id: "marta",
        key: "marta",
        type: "character",
        name: "Marta",
        description: "",
        tags: [],
        portraitAssetId: "marta-portrait",
      }],
    });

    const references = worldProjectReferences(snapshot, {
      condition: () => [],
      effects: () => [],
      text: () => [],
    });

    expect(references).toEqual([{
      resourceKind: "media-image",
      resourceId: "marta-portrait",
      detail: "character portrait",
      ownerKind: "character",
      ownerId: "marta",
      ownerLabel: "Marta",
      route: {
        type: "feature",
        feature: "world",
        workspace: "entity",
        data: { entityType: "character", resourceId: "marta" },
      },
    }]);
  });
});
