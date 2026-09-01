import type { RuleDescriptor } from "../../engine/rules/descriptor";

export const INVENTORY_CONDITIONS = [
  { type: "has_item", label: "has item" },
  { type: "lacks_item", label: "lacks item" },
] as const satisfies readonly RuleDescriptor[];

export const INVENTORY_EFFECTS = [
  { type: "give_item", label: "give item" },
  { type: "remove_item", label: "remove item" },
  { type: "set_item_state", label: "change item state" },
  { type: "set_body_background", label: "set body background" },
] as const satisfies readonly RuleDescriptor[];
