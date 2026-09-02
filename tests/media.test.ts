import { describe, expect, it } from "vitest";
import { applyOperations } from "../src/engine/project/mutations";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { executeEffects } from "../src/engine/rules/executeEffects";
import { createMediaAsset } from "../src/features/media/assets";
import {
  addSynthVoice,
  createStarterSynth,
  duplicateSynthVoice,
  MAX_SYNTH_STEPS,
  MAX_SYNTH_VOICES,
  removeSynthVoice,
  resizeSynthSequence,
  validateSynth,
} from "../src/features/media/synth";
import { emptyVectorGrid, paintVectorCell, serializeVectorGrid } from "../src/features/media/vectorAsset";
import { project } from "./fixtures";

describe("stable media assets", () => {
  it("keeps media identity separate from content location", () => {
    const asset = createMediaAsset({
      id: "asset-chime",
      name: "chime.wav",
      mimeType: "audio/wav",
      contentKey: "content_chime_01",
      byteLength: 128,
    });
    expect(asset).toMatchObject({ id: "asset-chime", kind: "audio", contentKey: "content_chime_01" });
    expect(asset).not.toHaveProperty("url");
    expect(asset).not.toHaveProperty("dataUrl");
    expect(asset).not.toHaveProperty("source");
  });

  it("serializes the 32x32 editor as scalable SVG without a fixed rendered size", () => {
    let cells = emptyVectorGrid();
    cells = paintVectorCell(cells, 0, 0, "#ffffff");
    cells = paintVectorCell(cells, 1, 0, "#ffffff");
    const svg = serializeVectorGrid(cells);
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect x="0" y="0" width="2" height="1" fill="#ffffff"/>');
    expect(svg).not.toMatch(/<svg[^>]+\swidth=/);
    expect(svg).not.toMatch(/<svg[^>]+\sheight=/);
  });

  it("keeps presentation role independent from intrinsic dimensions", () => {
    const asset = createMediaAsset({
      id: "asset-vector",
      name: "vector.svg",
      mimeType: "image/svg+xml",
      contentKey: "content_vector_01",
      byteLength: 80,
      intrinsicWidth: 32,
      intrinsicHeight: 32,
      defaultPresentation: "overlay",
      authoringMode: "grid32",
    });
    expect(asset.defaultPresentation).toBe("overlay");
    expect(asset.intrinsicWidth).toBe(32);
  });

  it("keeps a simple audible starter expandable through bounded advanced controls", () => {
    let sound = createStarterSynth("sound");
    expect(sound.voices).toHaveLength(1);
    expect(sound.voices[0].steps).toHaveLength(4);
    expect(sound.voices[0].steps.some((step) => step.active)).toBe(true);

    sound = resizeSynthSequence(sound, MAX_SYNTH_STEPS);
    sound = duplicateSynthVoice(sound, 0);
    while (sound.voices.length < MAX_SYNTH_VOICES) sound = addSynthVoice(sound);
    expect(sound.voices).toHaveLength(MAX_SYNTH_VOICES);
    expect(sound.voices.every((voice) => voice.steps.length === MAX_SYNTH_STEPS)).toBe(true);
    expect(addSynthVoice(sound)).toBe(sound);
    expect(validateSynth(sound)).toEqual([]);

    sound = removeSynthVoice(sound, 2);
    expect(sound.voices).toHaveLength(MAX_SYNTH_VOICES - 1);
  });

  it("persists only media metadata as feature-owned project data", () => {
    const asset = createMediaAsset({
      name: "chime.wav",
      mimeType: "audio/wav",
      contentKey: "content_chime_02",
      byteLength: 1,
    });
    const updated = applyOperations(project(), [{ type: "mediaAsset.upsert", asset }]);
    expect(updated.mediaAssets).toEqual([asset]);
  });

  it("deletes media resources through their feature-owned mutation handlers", () => {
    const sound = createStarterSynth("sound");
    const asset = createMediaAsset({ name: "chime.wav", mimeType: "audio/wav", contentKey: "content_chime_03", byteLength: 1 });
    const snapshot = project({ synthSounds: [sound], mediaAssets: [asset] });
    const updated = applyOperations(snapshot, [{ type: "synth.delete", id: sound.id }, { type: "mediaAsset.delete", id: asset.id }]);
    expect(updated.synthSounds).toEqual([]);
    expect(updated.mediaAssets).toEqual([]);
  });

  it("keeps runtime effects on stable IDs instead of storage locations", () => {
    const snapshot = project();
    const execution = executeEffects(snapshot, createEmptyPlayState(snapshot), [{ id: "play-chime", type: "audio", assetId: "asset-chime" }]);
    expect(execution.events).toContainEqual({ type: "audio", assetId: "asset-chime" });
  });
});
