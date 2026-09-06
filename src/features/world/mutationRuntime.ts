import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertEntity: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "entity.upsert") return;
  snapshot.entities = upsertById(snapshot.entities, operation.entity);
};

const deleteEntity: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "entity.delete") return;
  snapshot.entities = snapshot.entities.filter((entity) => entity.id !== operation.id);
};

export const WORLD_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "entity.upsert": upsertEntity,
  "entity.delete": deleteEntity,
};
