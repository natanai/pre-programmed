import type { EntityDefinition } from "./model";

/** Project mutation payloads owned by the World feature. */
export type WorldMutationOperation =
  | { type: "entity.upsert"; entity: EntityDefinition };
