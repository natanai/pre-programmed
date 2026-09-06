import type { EntityDefinition } from "../../src/features/world/model";
import { parseJson } from "../db/json";
import { hookStatements, loadHooksForKind, resetHooksForKind } from "./operationHooks";
import type { WorkerFeaturePersistence } from "./types";

type EntityRow = {
  id: string;
  key: string;
  entity_type: "character" | "location";
  name: string;
  description: string;
  tags_json: string;
  portrait_asset_id: string | null;
  operation_interactable: number;
  operations_json: string;
};

function canonicalEntity(entity: EntityDefinition): EntityDefinition {
  return entity.type === "location"
    ? { ...entity, portraitAssetId: null }
    : entity;
}

export const worldFeaturePersistence: WorkerFeaturePersistence = {
  id: "world",
  migrations: [
    {
      id: 42,
      name: "world-character-portrait-media-reference",
      sql: `
        ALTER TABLE entity_definitions ADD COLUMN portrait_asset_id TEXT;

        UPDATE project_meta SET schema_version = 42 WHERE id = 1;
      `,
    },
  ],

  async load(db) {
    const [entities, hookGroups] = await Promise.all([
      db.prepare(
        "SELECT id, key, entity_type, name, description, tags_json, portrait_asset_id, operation_interactable, operations_json FROM entity_definitions ORDER BY entity_type, key",
      ).all<EntityRow>(),
      loadHooksForKind(db, "world.entity"),
    ]);

    return {
      entities: entities.results.map((row): EntityDefinition => canonicalEntity({
        id: row.id,
        key: row.key,
        type: row.entity_type,
        name: row.name,
        description: row.description,
        tags: parseJson(row.tags_json, []),
        portraitAssetId: row.portrait_asset_id,
        interactable: Boolean(row.operation_interactable),
        operations: parseJson(row.operations_json, []),
        hooks: hookGroups.get(row.id) ?? [],
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type !== "entity.upsert") return null;
    const entity = canonicalEntity(operation.entity);
    return [
      db.prepare(
        `INSERT INTO entity_definitions
         (id, key, entity_type, name, description, tags_json, portrait_asset_id, operation_interactable, operations_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET key=excluded.key, entity_type=excluded.entity_type,
           name=excluded.name, description=excluded.description, tags_json=excluded.tags_json,
           portrait_asset_id=excluded.portrait_asset_id,
           operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
           updated_at=CURRENT_TIMESTAMP`,
      ).bind(
        entity.id,
        entity.key,
        entity.type,
        entity.name,
        entity.description,
        JSON.stringify(entity.tags),
        entity.type === "character" ? entity.portraitAssetId ?? null : null,
        Number(entity.interactable ?? false),
        JSON.stringify(entity.operations ?? []),
      ),
      ...hookStatements(db, "world.entity", entity.id, entity.hooks),
    ];
  },

  resetStatements(db) {
    return [resetHooksForKind(db, "world.entity"), db.prepare("DELETE FROM entity_definitions")];
  },

  restoreOperations(snapshot) {
    return snapshot.entities.map((entity) => ({ type: "entity.upsert" as const, entity: canonicalEntity(entity) }));
  },
};
