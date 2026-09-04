import type { AuthorToolContributor } from "../../../author/tools/types";
import type { AuthorSearchContributor } from "../../../author/search/types";

export const narrativeAuthorTools: AuthorToolContributor = (context) => [{
  groupId: "systems",
  groupLabel: "GAME SYSTEMS",
  groupOrder: 20,
  toolOrder: 10,
  tool: {
    id: "structure",
    label: "STRUCTURE",
    description: "Browse nodes, links, and authored interactions.",
    onSelect: () => context.pushTask({ type: "feature", feature: "narrative", workspace: "structure" }),
  },
}];

export const narrativeAuthorSearch: AuthorSearchContributor = (context) => {
  const currentNode = context.snapshot.nodes.find((node) => node.id === context.playState.currentNodeId);
  if (!currentNode) return [];
  const editNode = () => context.pushTask({
    type: "feature" as const,
    feature: "narrative",
    workspace: "node",
    data: { nodeId: currentNode.id },
  });
  return [
    {
      id: "narrative:node-text-rules",
      groupLabel: `NODE #${currentNode.nodeNumber}`,
      label: "NODE TEXT + TEXT RULES",
      description: `Edit Node #${currentNode.nodeNumber} prose, speaker, location, timing, and presentation.`,
      searchText: "current node writing narration speaker character voice performance pause fast speed shout hit emphasis notation cue rules",
      onSelect: editNode,
    },
    {
      id: "narrative:input-response-rules",
      groupLabel: `NODE #${currentNode.nodeNumber}`,
      label: "NODE INPUTS + RESPONSES",
      description: `Edit valid inputs and responses owned by Node #${currentNode.nodeNumber}.`,
      searchText: "current node input inputs label labels rule rules response outcome effect effects condition when audio synth image speaker character text interaction",
      onSelect: editNode,
    },
    {
      id: "narrative:invalid-response-rules",
      groupLabel: `NODE #${currentNode.nodeNumber}`,
      label: "NODE INVALID INPUT RESPONSE",
      description: `Edit Node #${currentNode.nodeNumber}'s fallback when player text matches nothing there.`,
      searchText: "current node unmatched unknown invalid fallback label rule response outcome effect condition sound",
      onSelect: editNode,
    },
  ];
};
