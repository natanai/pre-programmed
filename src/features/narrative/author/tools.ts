import type { AuthorToolContributor } from "../../../author/tools/types";
import { notationForNarrativeInteraction } from "./notation";

export const narrativeAuthorTools: AuthorToolContributor = (context) => {
  const currentNode = context.snapshot.nodes.find((node) => node.id === context.playState.currentNodeId);
  if (!currentNode) return [];
  const fallbackInput = context.snapshot.interactions.find((interaction) =>
    interaction.sourceNodeId === context.playState.currentNodeId
    && interaction.matchMode === "fallback");
  const fallbackNotation = fallbackInput
    ? notationForNarrativeInteraction(context.snapshot, context.playState, fallbackInput)
    : "";

  return [
    {
      groupId: "scene",
      groupLabel: "CURRENT SCENE",
      groupOrder: 10,
      toolOrder: 10,
      tool: {
        id: "edit-node",
        label: "EDIT NODE",
        description: "Text, speaker, location, tags, and presentation.",
        onSelect: () => context.pushPanel({ type: "node", node: currentNode }),
      },
    },
    {
      groupId: "scene",
      groupLabel: "CURRENT SCENE",
      groupOrder: 10,
      toolOrder: 20,
      tool: {
        id: "add-input",
        label: "ADD VALID INPUT",
        description: "Manual form; typing a new command at U:\\> is faster.",
        onSelect: () => context.pushPanel({ type: "interaction" }),
      },
    },
    {
      groupId: "scene",
      groupLabel: "CURRENT SCENE",
      groupOrder: 10,
      toolOrder: 30,
      tool: {
        id: "invalid-input",
        label: fallbackInput ? `${fallbackNotation} INVALID INPUT` : "ADD INVALID INPUT",
        description: "What happens when player text does not match a valid input.",
        tone: fallbackNotation === "[D]" ? "draft" : "normal",
        onSelect: () => context.pushPanel({ type: "interaction", interaction: fallbackInput, fallback: true }),
      },
    },
    {
      groupId: "systems",
      groupLabel: "GAME SYSTEMS",
      groupOrder: 20,
      toolOrder: 10,
      tool: {
        id: "structure",
        label: "STRUCTURE",
        description: "Browse nodes, links, and authored interactions.",
        onSelect: () => context.pushPanel({ type: "structure" }),
      },
    },
  ];
};
