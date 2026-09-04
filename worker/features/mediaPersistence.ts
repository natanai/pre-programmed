import { normalizeMediaAssetAuthoringMode, type MediaAsset, type SynthSound } from "../../src/features/media/model";
import { parseJson } from "../db/json";
import { generatedMediaContentStatement } from "../mediaContent";
import type { WorkerFeaturePersistence } from "./types";

type SynthRow = { id: string; key: string; label: string; recipe_json: string };
type AssetRow = {
  id: string;
  name: string;
  kind: MediaAsset["kind"];
  mime_type: string;
  content_key: string | null;
  byte_length: number;
  intrinsic_width: number | null;
  intrinsic_height: number | null;
  default_presentation: MediaAsset["defaultPresentation"];
  authoring_mode: string;
};

export const mediaFeaturePersistence: WorkerFeaturePersistence = {
  id: "media",
  migrations: [
    {
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
    },
    {
      id: 20,
      name: "media-content-store-v2",
      sql: `
        CREATE TABLE media_assets_v20 (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('audio', 'image')),
          mime_type TEXT NOT NULL,
          content_key TEXT,
          byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
          intrinsic_width REAL,
          intrinsic_height REAL,
          default_presentation TEXT NOT NULL DEFAULT 'overlay' CHECK (default_presentation IN ('inline', 'overlay')),
          authoring_mode TEXT NOT NULL DEFAULT 'file' CHECK (authoring_mode IN ('file', 'grid32')),
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO media_assets_v20
          (id, name, kind, mime_type, content_key, byte_length, intrinsic_width, intrinsic_height, default_presentation, authoring_mode, updated_at)
        SELECT
          id,
          name,
          kind,
          mime_type,
          NULL,
          size,
          width,
          height,
          CASE WHEN kind = 'image' AND width IS NOT NULL AND height IS NOT NULL AND width <= 32 AND height <= 32 THEN 'inline' ELSE 'overlay' END,
          'file',
          updated_at
        FROM media_assets;

        DROP TABLE media_assets;
        ALTER TABLE media_assets_v20 RENAME TO media_assets;
        CREATE INDEX media_assets_content_key_idx ON media_assets(content_key);

        UPDATE project_meta SET schema_version = 20 WHERE id = 1;
      `,
    },
    {
      id: 21,
      name: "media-text-content-store",
      sql: `
        CREATE TABLE IF NOT EXISTS media_text_content (
          content_key TEXT PRIMARY KEY,
          mime_type TEXT NOT NULL,
          content_text TEXT NOT NULL,
          byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        UPDATE project_meta SET schema_version = 21 WHERE id = 1;
      `,
    },
    {
      id: 30,
      name: "media-general-vector-grid",
      sql: `
        CREATE TABLE media_assets_v30 (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('audio', 'image')),
          mime_type TEXT NOT NULL,
          content_key TEXT,
          byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
          intrinsic_width REAL,
          intrinsic_height REAL,
          default_presentation TEXT NOT NULL DEFAULT 'overlay' CHECK (default_presentation IN ('inline', 'overlay')),
          authoring_mode TEXT NOT NULL DEFAULT 'file' CHECK (authoring_mode IN ('file', 'vector-grid')),
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO media_assets_v30
          (id, name, kind, mime_type, content_key, byte_length, intrinsic_width, intrinsic_height, default_presentation, authoring_mode, updated_at)
        SELECT
          id,
          name,
          kind,
          mime_type,
          content_key,
          byte_length,
          intrinsic_width,
          intrinsic_height,
          default_presentation,
          CASE WHEN authoring_mode = 'grid32' THEN 'vector-grid' ELSE authoring_mode END,
          updated_at
        FROM media_assets;

        DROP TABLE media_assets;
        ALTER TABLE media_assets_v30 RENAME TO media_assets;
        CREATE INDEX media_assets_content_key_idx ON media_assets(content_key);

        UPDATE project_meta SET schema_version = 30 WHERE id = 1;
      `,
    },
  ],

  async load(db) {
    const [synths, assets] = await Promise.all([
      db.prepare("SELECT id, key, label, recipe_json FROM synth_sounds ORDER BY key").all<SynthRow>(),
      db.prepare(`SELECT id, name, kind, mime_type, content_key, byte_length, intrinsic_width, intrinsic_height,
        default_presentation, authoring_mode FROM media_assets ORDER BY name, id`).all<AssetRow>(),
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
        mimeType: row.mime_type,
        contentKey: row.content_key,
        byteLength: row.byte_length,
        intrinsicWidth: row.intrinsic_width,
        intrinsicHeight: row.intrinsic_height,
        defaultPresentation: row.default_presentation,
        authoringMode: normalizeMediaAssetAuthoringMode(row.authoring_mode),
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
      const contentStatements = operation.generatedContent && asset.contentKey
        ? [generatedMediaContentStatement(db, asset.contentKey, operation.generatedContent)]
        : [];
      return [
        ...contentStatements,
        db.prepare(
          `INSERT INTO media_assets
            (id, name, kind, mime_type, content_key, byte_length, intrinsic_width, intrinsic_height, default_presentation, authoring_mode, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, kind=excluded.kind, mime_type=excluded.mime_type,
             content_key=excluded.content_key, byte_length=excluded.byte_length,
             intrinsic_width=excluded.intrinsic_width, intrinsic_height=excluded.intrinsic_height,
             default_presentation=excluded.default_presentation, authoring_mode=excluded.authoring_mode,
             updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          asset.id,
          asset.name,
          asset.kind,
          asset.mimeType,
          asset.contentKey,
          asset.byteLength,
          asset.intrinsicWidth,
          asset.intrinsicHeight,
          asset.defaultPresentation,
          asset.authoringMode,
        ),
      ];
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