import { describe, expect, it } from "vitest";
import type { PremidiComposition } from "../src/features/media/vendor/premidi-schema.js";
import { parse, validate } from "../src/features/media/vendor/premidi-schema.js";
import { validateMutationBody } from "../worker/validation";
import { migratePortableProject } from "../worker/portableProject";
import { project } from "./fixtures";

const score: PremidiComposition = {
  format: "pre-midi", version: 2, id: "song-1", title: "Aether", bpm: 120,
  beatsPerBar: 4, stepsPerBeat: 4, bars: 2,
  instruments: [{
    id: "instrument-1", name: "Lead", waveform: "triangle", volume: 0.7, attack: 0.01,
    release: 0.12, chunks: [{ id: "chunk-1", name: "Theme", notes: [
      { id: "note-1", pitch: 60, start: 0, duration: 4, velocity: 0.8 },
    ] }], timeline: ["chunk-1", null],
  }],
};

describe("native pre-midi boundaries", () => {
  it("preserves every music note and stable identity across native file exchange", () => {
    expect(validate(score)).toEqual([]);
    expect(parse(JSON.stringify(score))).toEqual(score);
    expect(score.instruments[0].timeline).toEqual(["chunk-1", null]);
  });
  it("validates compositions through the ordinary project mutation contract", () => {
    expect(validateMutationBody({
      expectedRevision: 0, description: "Import pre-midi",
      operations: [{ type: "premidi.upsert", composition: score }],
    })).toBeNull();
    expect(validateMutationBody({
      expectedRevision: 0, description: "Broken pre-midi",
      operations: [{ type: "premidi.upsert", composition: { ...score, version: 99 } }],
    })).toMatch(/premidi composition/i);
  });
  it("retains compositions in the whole-game .ppgame document", () => {
    const snapshot = project({ mediaCompositions: [score] });
    const { revision: _revision, ...portable } = snapshot;
    const imported = migratePortableProject({
      format: "pre-programmed-project", version: 3, exportedAt: "2026-10-24T12:00:00Z",
      sourceSchemaVersion: snapshot.schemaVersion, project: portable, featureData: {},
    });
    expect(imported.project.mediaCompositions).toEqual([score]);
  });
});
