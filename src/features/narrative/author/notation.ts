import { buildGraphIndex, notationForNode } from "../../../game/graph";
import type { Interaction, PlayState, ProjectSnapshot } from "../../../game/model";

type GraphIndex = ReturnType<typeof buildGraphIndex>;

export function notationForNarrativeInteraction(
  snapshot: ProjectSnapshot,
  playState: PlayState,
  interaction: Interaction,
  graph: GraphIndex = buildGraphIndex(snapshot),
) {
  if (interaction.outcomes.some((outcome) => (outcome.authorStatus ?? "configured") === "draft")) return "[D]";
  const first = [...interaction.outcomes].sort((left, right) => left.order - right.order)[0];
  if (!first) return "[D]";
  if (first.disposition === "stay" || !first.destinationNodeId) return "[H]";
  return notationForNode(
    snapshot,
    graph,
    playState.currentNodeId,
    playState.traversal,
    first.destinationNodeId,
  ).join("") || "[A1]";
}
