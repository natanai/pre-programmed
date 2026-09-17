import { flowDestination } from "../flow";
import { buildGraphIndex, notationForNode } from "../graph";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import type { Condition } from "../../../engine/rules/model";
import type { Interaction } from "../model";

type GraphIndex = ReturnType<typeof buildGraphIndex>;

/**
 * Compact Author notation for a Node Entry Response's automatic selection rule.
 * Entry timing is intentionally terse to match the graph notation language
 * ([H], [D2], [L], etc.) while remaining a separate presentation concern.
 */
export function notationForNodeOpeningCondition(condition: Condition) {
  switch (condition.type) {
    case "always": return "[ANY]";
    case "attempt": {
      if (condition.operator === "eq") return `[${condition.value}]`;
      if (condition.operator === "gte") return `[${condition.value}+]`;
      if (condition.operator === "gt") return `[>${condition.value}]`;
      if (condition.operator === "lte") return `[<=${condition.value}]`;
      if (condition.operator === "lt") return `[<${condition.value}]`;
      return `[!=${condition.value}]`;
    }
    case "variable": return "[VAR]";
    case "flag": return "[FLAG]";
    case "has_item": return "[ITEM]";
    case "lacks_item": return "[!ITEM]";
    case "visited": return condition.value ? "[VISIT]" : "[!VISIT]";
    case "state": return "[STATE]";
    case "all": return `[ALL:${condition.conditions.length}]`;
    case "any": return `[OR:${condition.conditions.length}]`;
    case "not": return "[NOT]";
  }
}

export function notationForNarrativeInteraction(
  snapshot: ProjectSnapshot,
  playState: PlayState,
  interaction: Interaction,
  graph: GraphIndex = buildGraphIndex(snapshot),
) {
  if (interaction.outcomes.some((outcome) => (outcome.authorStatus ?? "configured") === "draft")) return "[D]";
  const first = [...interaction.outcomes].sort((left, right) => left.order - right.order)[0];
  if (!first) return "[D]";
  const destination = flowDestination(first.after);
  if (!destination) return "[H]";
  return notationForNode(
    snapshot,
    graph,
    playState.currentNodeId,
    playState.traversal,
    destination.nodeId,
  ).join("") || "[A1]";
}
