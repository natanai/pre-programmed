import type { BodyBackgroundDefinition, ItemDefinition } from "./model";

/** Project mutation payloads owned by the Inventory feature. */
export type InventoryMutationOperation =
  | { type: "item.upsert"; item: ItemDefinition }
  | { type: "item.delete"; id: string }
  | { type: "bodyBackground.upsert"; background: BodyBackgroundDefinition }
  | { type: "bodyBackground.delete"; id: string }
  | { type: "bodyBackground.starting"; id: string | null };
