import { describe, expect, it } from "vitest";
import { applyOperations } from "../src/engine/project/mutations";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { executeEffects } from "../src/engine/rules/executeEffects";
import { createEmbeddedAsset } from "../src/features/media/assets";
import { legacyAssetId } from "../src/features/media/assetReference";
import { project } from "./fixtures";

describe("stable media assets", () => {
  it("converts path-only prototype references into deterministic repository IDs", () => {
    expect(legacyAssetId("/assets/audio/chime.ogg")).toBe("repo:/assets/audio/chime.ogg");
    expect(legacyAssetId("repo:/assets/audio/chime.ogg")).toBe("repo:/assets/audio/chime.ogg");
  });

  it("persists an embedded asset as feature-owned project data", () => {
    const asset = createEmbeddedAsset({
      name: "chime.wav",
      mimeType: "audio/wav",
      dataUrl: "data:audio/wav;base64,AA==",
      size: 1,
    });
    const updated = applyOperations(project(), [{ type: "mediaAsset.upsert", asset }]);
    expect(updated.mediaAssets).toEqual([expect.objectContaining({
      id: asset.id,
      name: "chime.wav",
      kind: "audio",
      source: "embedded",
    })]);
  });

  it("keeps runtime effects on stable IDs instead of storage URLs", () => {
    const snapshot = project();
    const execution = executeEffects(snapshot, createEmptyPlayState(snapshot), [{
      id: "play-chime",
      type: "audio",
      assetId: "asset-chime",
    }]);
    expect(execution.events).toContainEqual({ type: "audio", assetId: "asset-chime" });
  });
});
