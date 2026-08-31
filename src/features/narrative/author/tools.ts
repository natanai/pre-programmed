import type { AuthorToolContributor } from "../../../author/tools/types";

export const narrativeAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "scene",
    groupLabel: "CURRENT SCENE",
    groupOrder: 10,
    toolOrder: 10,
    tool: {
      id: "edit-node",
      label: "EDIT NODE",
      description: "Text, speaker, location, tags, and presentation.",
      onSelect: () => context.pushPanel({ type: "node", node: context.currentNode }),
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
      label: context.fallbackInput ? `${context.notationForInput(context.fallbackInput)} INVALID INPUT` : "ADD INVALID INPUT",
      description: "What happens when player text does not match a valid input.",
      tone: context.invalidDraft ? "draft" : "normal",
      onSelect: () => context.pushPanel({ type: "interaction", interaction: context.fallbackInput, fallback: true }),
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
