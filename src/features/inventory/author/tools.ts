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
      description: "Author items, body types, equipment slots, and inventory behavior.",
      onSelect: () => context.pushTask({ type: "feature", feature: "inventory", workspace: "inventory" }),
    },
  },
];
