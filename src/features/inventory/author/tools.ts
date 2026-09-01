import type { AuthorToolContributor } from "../../../author/tools/types";

export const inventoryAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "systems",
    groupLabel: "GAME SYSTEMS",
    groupOrder: 20,
    toolOrder: 30,
    tool: {
      id: "inventory",
      label: "INVENTORY",
      description: "Inspect inventory and author item definitions.",
      onSelect: () => context.pushPanel({ type: "feature", feature: "inventory", workspace: "inventory" }),
    },
  },
];
