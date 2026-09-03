import type { Value } from "../../engine/rules/primitives";

export type InventoryCondition =
  | { type: "has_item"; itemId: string; minimum?: number }
  | { type: "lacks_item"; itemId: string };

export type InventoryEffect =
  | { id: string; type: "give_item"; itemId: string; quantity: number }
  | { id: string; type: "remove_item"; itemId: string; quantity: number }
  | { id: string; type: "set_item_state"; itemId: string; key: string; value: Value }
  | { id: string; type: "set_body_background"; backgroundId: string };
