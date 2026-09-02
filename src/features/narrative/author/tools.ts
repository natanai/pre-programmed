import type { AuthorToolContributor } from "../../../author/tools/types";
import type { AuthorSearchContributor } from "../../../author/search/types";
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
        onSelect: () => context.pushTask({
          type: "feature",
          feature: "narrative",
          workspace: "node",
          data: { nodeId: currentNode.id },
        }),
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
        onSelect: () => context.pushTask({
          type: "feature",
          feature: "narrative",
          workspace: "interaction",
        }),
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
        onSelect: () => context.pushTask({
          type: "feature",
          feature: "narrative",
          workspace: "interaction",
          data: {
            ...(fallbackInput ? { interactionId: fallbackInput.id } : {}),
            fallback: "true",
          },
        }),
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
        onSelect: () => context.pushTask({ type: "feature", feature: "narrative", workspace: "structure" }),
      },
    },
  ];
};

export const narrativeAuthorSearch: AuthorSearchContributor = (context) => {
  const currentNode = context.snapshot.nodes.find((node) => node.id === context.playState.currentNodeId);
  const fallback = context.snapshot.interactions.find((interaction) =>
    interaction.sourceNodeId === context.playState.currentNodeId && interaction.matchMode === "fallback");
  if (!currentNode) return [];
  return [
    {
      id: "narrative:node-text-rules",
      groupLabel: "CURRENT SCENE",
      label: "NODE TEXT + TEXT RULES",
      description: "Edit prose, speaker, location, inline timing rules, and presentation cues.",
      searchText: "writing narration speaker character voice performance pause fast speed shout hit emphasis notation cue rules",
      onSelect: () => context.pushTask({ type: "feature", feature: "narrative", workspace: "node", data: { nodeId: currentNode.id } }),
    },
    {
      id: "narrative:input-response-rules",
      groupLabel: "CURRENT SCENE",
      label: "INPUT RESPONSES + OUTCOME LABELS",
      description: "Author valid input, response text, outcome labels, conditions, effects, sound, and text rules.",
      searchText: "label labels rule rules response outcome effect effects condition when audio synth image speaker character text command interaction",
      onSelect: () => context.pushTask({ type: "feature", feature: "narrative", workspace: "interaction" }),
    },
    {
      id: "narrative:invalid-response-rules",
      groupLabel: "CURRENT SCENE",
      label: "INVALID INPUT RESPONSE",
      description: "Define fallback response text, labels, conditions, effects, and presentation rules.",
      searchText: "unmatched unknown invalid fallback label rule response outcome effect condition sound",
      onSelect: () => context.pushTask({
        type: "feature", feature: "narrative", workspace: "interaction",
        data: { ...(fallback ? { interactionId: fallback.id } : {}), fallback: "true" },
      }),
    },
  ];
};
