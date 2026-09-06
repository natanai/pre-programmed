import type { RuleDescriptor } from "../../engine/rules/descriptor";

export const WORLD_CONDITIONS = [] as const satisfies readonly RuleDescriptor[];

export const WORLD_EFFECTS = [
  { type: "world_target_description", label: "show target description" },
  { type: "world_target_portrait", label: "show target portrait" },
] as const satisfies readonly RuleDescriptor[];
