import type { RuleDescriptor } from "../../engine/rules/descriptor";

export const MEDIA_CONDITIONS = [] as const satisfies readonly RuleDescriptor[];

export const MEDIA_EFFECTS = [
  { type: "synth", label: "play synth" },
  { type: "audio", label: "play repo audio" },
  { type: "art", label: "show sprite/art" },
] as const satisfies readonly RuleDescriptor[];
