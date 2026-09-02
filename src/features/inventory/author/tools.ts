import type { AuthorSearchContributor } from "../../../author/search/types";
import type { AuthorToolContributor } from "../../../author/tools/types";

export const inventoryAuthorTools: AuthorToolContributor = (context) => [{
  groupId: "systems", groupLabel: "GAME SYSTEMS", groupOrder: 20, toolOrder: 40,
  tool: { id: "inventory", label: "INVENTORY", description: "Possessions, item behavior, and inventory presentation.", searchText: "inventory item items possessions grid list", onSelect: () => context.pushTask({ type: "feature", feature: "inventory", workspace: "library" }) },
}];
export const inventoryAuthorSearch: AuthorSearchContributor = (context) => [{
  id: "inventory:library", groupLabel: "GAME SYSTEMS", label: "INVENTORY", description: "Create items and configure how possessions are presented.", searchText: "inventory item items possessions grid list", onSelect: () => context.pushTask({ type: "feature", feature: "inventory", workspace: "library" }),
}];
