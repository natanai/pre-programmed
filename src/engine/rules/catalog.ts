import { CORE_CONDITIONS, CORE_EFFECTS } from "./coreContribution";
import { MEDIA_CONDITIONS, MEDIA_EFFECTS } from "../../features/media/rules";
import { NARRATIVE_CONDITIONS, NARRATIVE_EFFECTS } from "../../features/narrative/rules";
import { STATE_CONDITIONS, STATE_EFFECTS } from "../../features/state/rules";

export const CONDITION_RULES = [
  ...CORE_CONDITIONS,
  ...NARRATIVE_CONDITIONS,
  ...STATE_CONDITIONS,
  ...MEDIA_CONDITIONS,
] as const;

export const EFFECT_RULES = [
  ...CORE_EFFECTS,
  ...NARRATIVE_EFFECTS,
  ...STATE_EFFECTS,
  ...MEDIA_EFFECTS,
] as const;

export const CONDITION_TYPE_SET: ReadonlySet<string> = new Set(CONDITION_RULES.map((rule) => rule.type));
export const EFFECT_TYPE_SET: ReadonlySet<string> = new Set(EFFECT_RULES.map((rule) => rule.type));
