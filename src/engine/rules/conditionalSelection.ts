import { seededInitializationIndex } from "../runtime/initializationRandom";
import { evaluateCondition } from "./conditions";
import type { ConditionContext } from "./conditionRuntime";
import type { Condition } from "./model";

export type ConditionalCandidate = {
  id: string;
  order: number;
  condition: Condition;
};

export type ConditionalSelectionMode = "first" | "random";

/**
 * Canonical conditional selection used by authored systems.
 *
 * "first" preserves ordered priority. "random" first evaluates the same
 * conditions, then selects uniformly from the matching candidates using the
 * run's one world seed plus the authored event identity and occurrence. This
 * keeps replay behavior deterministic without adding a second random source.
 */
export function selectConditionalCandidate<T extends ConditionalCandidate>(
  candidates: readonly T[],
  context: ConditionContext,
  mode: ConditionalSelectionMode = "first",
): T | null {
  const matching = [...candidates]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .filter((candidate) => evaluateCondition(candidate.condition, context));

  if (!matching.length) return null;
  if (mode !== "random" || matching.length === 1) return matching[0];

  const scopeKey = context.scope ? `${context.scope.kind}:${context.scope.id}` : "unscoped";
  const eventKey = context.eventKey ?? scopeKey;
  const occurrence = context.occurrence ?? 0;
  const index = seededInitializationIndex(
    context.state.initializationSeed,
    `conditional-selection:${eventKey}:${occurrence}`,
    matching.length,
  );
  return matching[Math.max(0, index)] ?? matching[0];
}
