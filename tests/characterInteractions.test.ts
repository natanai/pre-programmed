import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { executeOperation } from "../src/features/operations/runtime";
import { WORLD_ENTITY_OPERATION_TARGET_KIND } from "../src/features/world/operationAdapter";
import { WORLD_SEMANTIC_REFERENCE_PROVIDERS } from "../src/features/world/semanticReferences";
import { project } from "./fixtures";

function poiyo(description: string, portraitAssetId: string) {
  return {
    id: "poiyo",
    key: "poiyo",
    type: "character" as const,
    name: "Poiyo",
    description,
    tags: ["friend"],
    portraitAssetId,
    interactable: true,
    operations: ["inspect"],
    hooks: [{
      id: "poiyo-inspect",
      operation: "inspect",
      order: 0,
      condition: { type: "always" as const },
      responseText: "",
      effects: [
        { id: "description", type: "world_target_description" as const },
        { id: "portrait", type: "world_target_portrait" as const },
      ],
      success: true,
    }],
  };
}

describe("Character player interactions", () => {
  it("resolves description and portrait from the current Character at runtime", () => {
    const first = project({ entities: [poiyo("Poiyo is wearing a tiny hat.", "portrait-a")] });
    const state = { ...createEmptyPlayState(first, 0), lastCommand: "inspect poiyo" };
    const request = {
      target: { kind: WORLD_ENTITY_OPERATION_TARGET_KIND, id: "poiyo" },
      operation: "inspect",
    };

    const firstExecution = executeOperation(first, state, request, 0);
    expect(firstExecution.responseText).toBe("Poiyo is wearing a tiny hat.");
    expect(firstExecution.events).toMatchObject([{ type: "world_portrait", assetId: "portrait-a" }]);

    const changed = project({ entities: [poiyo("Poiyo has changed clothes.", "portrait-b")] });
    const changedExecution = executeOperation(changed, state, request, 0);
    expect(changedExecution.responseText).toBe("Poiyo has changed clothes.");
    expect(changedExecution.events).toMatchObject([{ type: "world_portrait", assetId: "portrait-b" }]);
  });

  it("exposes Characters as semantic command targets", () => {
    const characterProvider = WORLD_SEMANTIC_REFERENCE_PROVIDERS.find((provider) => provider.kind === "world.character");
    expect(characterProvider?.targetable).toBe(true);

    const snapshot = project({ entities: [poiyo("Description", "portrait-a")] });
    const state = createEmptyPlayState(snapshot, 0);
    const candidate = characterProvider?.candidates({ snapshot, state }).find((item) => item.id === "poiyo");
    expect(candidate?.target).toEqual({ kind: WORLD_ENTITY_OPERATION_TARGET_KIND, id: "poiyo" });
  });
});
