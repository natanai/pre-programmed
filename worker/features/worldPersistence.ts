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
  operation_interactable: number;
  operations_json: string;
};

function canonicalEntity(entity: EntityDefinition): EntityDefinition {
  return entity.type === "character"
    ? { ...entity, interactable: false, operations: [], hooks: [] }
    : entity;
}

export const worldFeaturePersistence: WorkerFeaturePersistence = {
  id: "world",

  async load(db) {
    const [entities, hookGroups] = await Promise.all([
      db.prepare(
        "SELECT id, key, entity_type, name, description, tags_json, operation_interactable, operations_json FROM entity_definitions ORDER BY entity_type, key",
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
         (id, key, entity_type, name, description, tags_json, operation_interactable, operations_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET key=excluded.key, entity_type=excluded.entity_type,
           name=excluded.name, description=excluded.description, tags_json=excluded.tags_json,
           operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
           updated_at=CURRENT_TIMESTAMP`,
      ).bind(
        entity.id,
        entity.key,
        entity.type,
        entity.name,
        entity.description,
        JSON.stringify(entity.tags),
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
