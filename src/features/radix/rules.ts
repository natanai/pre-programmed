import type { RuleDescriptor } from "../../engine/rules/descriptor";

export const RADIX_CONDITIONS = [] as const satisfies readonly RuleDescriptor[];

export const RADIX_EFFECTS = [
  { type: "radix", label: "run sort sequence" },
] as const satisfies readonly RuleDescriptor[];
