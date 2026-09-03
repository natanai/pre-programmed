import type { AuthorToolContributor } from "../../../author/tools/types";
import type { AuthorSearchContributor } from "../../../author/search/types";

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
      searchText: "item items body type equipment equip slot storage starting default wearable hand grid image behavior operation rule effect",
      onSelect: () => context.pushTask({ type: "feature", feature: "inventory", workspace: "inventory" }),
    },
  },
];

export const inventoryAuthorSearch: AuthorSearchContributor = (context) => [
  {
    id: "inventory:item-controls",
    groupLabel: "GAME SYSTEMS",
    label: "ITEMS + EQUIPMENT RULES",
    description: "Edit item names, images, operations, starting quantities, equipment slots, auto-equip, and storage behavior.",
      searchText: "item label name image inventory interaction player behavior operation operations response responses inspect use polish move remove equip unequip rule effects equipped auto give slot hand starting default storage space grid",
    onSelect: () => context.pushTask({ type: "feature", feature: "inventory", workspace: "inventory" }),
  },
  {
    id: "inventory:body-controls",
    groupLabel: "GAME SYSTEMS",
    label: "BODY TYPES + SLOTS",
    description: "Create body types, choose the starting body, draw slots, and assign starting equipment.",
    searchText: "body background active default starting equipment slot anatomy image wearable",
    onSelect: () => context.pushTask({ type: "feature", feature: "inventory", workspace: "inventory" }),
  },
];
