import type { EntityDefinition } from "./model";

export type WorldProjectSlice = {
  entities: EntityDefinition[];
};

export type WorldPlayStateSlice = {
  /** Player-facing Character names resolved once during new-world initialization. */
  characterNames: Record<string, string>;
};
