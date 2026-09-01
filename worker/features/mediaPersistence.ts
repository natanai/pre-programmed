import type { SynthSound } from "../../src/features/media/model";
import { parseJson } from "../db/json";
import type { WorkerFeaturePersistence } from "./types";

type SynthRow = { id: string; key: string; label: string; recipe_json: string };

export const mediaFeaturePersistence: WorkerFeaturePersistence = {
  id: "media",

  async load(db) {
    const synths = await db.prepare("SELECT id, key, label, recipe_json FROM synth_sounds ORDER BY key").all<SynthRow>();
    return {
      synthSounds: synths.results.map((row): SynthSound => ({
        ...parseJson<Omit<SynthSound, "id" | "key" | "label">>(row.recipe_json, {
          tempo: 120,
          loop: false,
          voices: [],
        }),
        id: row.id,
        key: row.key,
        label: row.label,
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type !== "synth.upsert") return null;
    const sound = operation.sound;
    const { id: _id, key: _key, label: _label, ...recipe } = sound;
    return [db.prepare(
      `INSERT INTO synth_sounds (id, key, label, recipe_json, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label,
         recipe_json=excluded.recipe_json, updated_at=CURRENT_TIMESTAMP`,
    ).bind(sound.id, sound.key, sound.label, JSON.stringify(recipe))];
  },

  resetStatements(db) {
    return [db.prepare("DELETE FROM synth_sounds")];
  },

  restoreOperations(snapshot) {
    return snapshot.synthSounds.map((sound) => ({ type: "synth.upsert" as const, sound }));
  },
};
