import type { RuleDescriptor } from "../../engine/rules/descriptor";

export const VALUES_CONDITIONS = [
  { type: "flag", label: "flag" },
  { type: "variable", label: "value comparison" },
] as const satisfies readonly RuleDescriptor[];

export const VALUES_EFFECTS = [
  { type: "set_flag", label: "set flag" },
  { type: "clear_flag", label: "clear flag" },
  { type: "set_value", label: "set value" },
  { type: "increment", label: "increment" },
  { type: "decrement", label: "decrement" },
] as const satisfies readonly RuleDescriptor[];
