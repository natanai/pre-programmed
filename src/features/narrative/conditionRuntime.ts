import type { ConditionHandler } from "../../engine/rules/conditionRuntime";

const visited: ConditionHandler = (condition, context) => {
  if (condition.type !== "visited") return false;
  return context.state.visitedNodeIds.includes(condition.nodeId) === condition.value;
};

export const NARRATIVE_CONDITION_HANDLERS: Readonly<Record<string, ConditionHandler>> = {
  visited,
};
