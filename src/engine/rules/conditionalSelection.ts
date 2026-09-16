import { evaluateCondition } from "./conditions";
import type { ConditionContext } from "./conditionRuntime";
import type { Condition } from "./model";

export type ConditionalCandidate = {
  id: string;
  order: number;
  condition: Condition;
};

/**
 * Canonical ordered conditional selection used by authored systems.
 * Ownership of candidate payloads remains with the feature that supplied them.
 */
export function selectConditionalCandidate<T extends ConditionalCandidate>(
  candidates: readonly T[],
  context: ConditionContext,
): T | null {
  return [...candidates]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .find((candidate) => evaluateCondition(candidate.condition, context)) ?? null;
}
