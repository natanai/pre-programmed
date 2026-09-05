import {
  findSemanticReferenceTokens,
  interpolateSemanticReferences,
} from "../../engine/references/runtime";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";

export type InterpolationContext = {
  snapshot: ProjectSnapshot;
  state: PlayState;
  now?: number;
};

/** Narrative text is one consumer of the engine-wide semantic reference runtime. */
export function interpolateText(template: string, context: InterpolationContext) {
  return interpolateSemanticReferences(template, context);
}

/** Source-compatible name for callers that inspect stored authored-text references. */
export const findInterpolationTokens = findSemanticReferenceTokens;
