import type { RuleDescriptor } from "./descriptor";

export const CORE_CONDITIONS = [
  { type: "always", label: "always" },
  { type: "all", label: "all (AND)" },
  { type: "any", label: "any (OR)" },
  { type: "not", label: "not" },
  { type: "attempt", label: "attempt count" },
  { type: "state", label: "state field" },
] as const satisfies readonly RuleDescriptor[];

export const CORE_EFFECTS = [] as const satisfies readonly RuleDescriptor[];
