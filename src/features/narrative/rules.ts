import type { RuleDescriptor } from "../../engine/rules/descriptor";

export const NARRATIVE_CONDITIONS = [
  { type: "visited", label: "visited node" },
] as const satisfies readonly RuleDescriptor[];

export const NARRATIVE_EFFECTS = [
  { type: "set_interaction_visibility", label: "show/hide interaction" },
  { type: "transition", label: "transition" },
] as const satisfies readonly RuleDescriptor[];
