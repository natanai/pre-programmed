import type { MediaAsset, SynthSound } from "../../src/features/media/model";
import { parseJson } from "../db/json";
import type { WorkerFeaturePersistence } from "./types";

type SynthRow = { id: string; key: string; label: string; recipe_json: string };
type AssetRow = {
  id: string;
  name: string;
  kind: MediaAsset["kind"];
  data_url: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
};

export const mediaFeaturePersistence: WorkerFeaturePersistence = {
  id: "media",
  migrations: [{
    id: 18,
    name: "media-stable-embedded-assets",
    sql: `
      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('audio', 'image')),
        data_url TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL CHECK (size >= 0),
        width INTEGER,
        height INTEGER,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      UPDATE project_meta SET schema_version = 18 WHERE id = 1;
    `,
  }],

  async load(db) {
    const [synths, assets] = await Promise.all([
      db.prepare("SELECT id, key, label, recipe_json FROM synth_sounds ORDER BY key").all<SynthRow>(),
      db.prepare("SELECT id, name, kind, data_url, mime_type, size, width, height FROM media_assets ORDER BY name, id").all<AssetRow>(),
    ]);
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
      mediaAssets: assets.results.map((row): MediaAsset => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        source: "embedded",
        dataUrl: row.data_url,
        mimeType: row.mime_type,
        size: row.size,
        width: row.width,
        height: row.height,
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type === "synth.upsert") {
      const sound = operation.sound;
      const { id: _id, key: _key, label: _label, ...recipe } = sound;
      return [db.prepare(
        `INSERT INTO synth_sounds (id, key, label, recipe_json, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label,
           recipe_json=excluded.recipe_json, updated_at=CURRENT_TIMESTAMP`,
      ).bind(sound.id, sound.key, sound.label, JSON.stringify(recipe))];
    }
    if (operation.type === "synth.delete") {
      return [db.prepare("DELETE FROM synth_sounds WHERE id = ?").bind(operation.id)];
    }
    if (operation.type === "mediaAsset.upsert") {
      const asset = operation.asset;
      return [db.prepare(
        `INSERT INTO media_assets (id, name, kind, data_url, mime_type, size, width, height, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, kind=excluded.kind,
           data_url=excluded.data_url, mime_type=excluded.mime_type, size=excluded.size,
           width=excluded.width, height=excluded.height, updated_at=CURRENT_TIMESTAMP`,
      ).bind(asset.id, asset.name, asset.kind, asset.dataUrl, asset.mimeType, asset.size, asset.width, asset.height)];
    }
    if (operation.type === "mediaAsset.delete") {
      return [db.prepare("DELETE FROM media_assets WHERE id = ?").bind(operation.id)];
    }
    return null;
  },

  resetStatements(db) {
    return [db.prepare("DELETE FROM synth_sounds"), db.prepare("DELETE FROM media_assets")];
  },

  restoreOperations(snapshot) {
    return [
      ...snapshot.synthSounds.map((sound) => ({ type: "synth.upsert" as const, sound })),
      ...(snapshot.mediaAssets ?? []).map((asset) => ({ type: "mediaAsset.upsert" as const, asset })),
    ];
  },
};
