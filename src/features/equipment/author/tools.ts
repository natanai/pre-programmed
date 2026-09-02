import type { AuthorSearchContributor } from "../../../author/search/types";
import type { AuthorToolContributor } from "../../../author/tools/types";

export const equipmentAuthorTools: AuthorToolContributor = (context) => [{
  groupId: "systems", groupLabel: "GAME SYSTEMS", groupOrder: 20, toolOrder: 50,
  tool: { id: "equipment", label: "EQUIPMENT", description: "Body types, equipment slots, and item compatibility.", searchText: "equipment equip body bodies slot slots wearable loadout", onSelect: () => context.pushTask({ type: "feature", feature: "equipment", workspace: "library" }) },
}];
export const equipmentAuthorSearch: AuthorSearchContributor = (context) => [{
  id: "equipment:library", groupLabel: "GAME SYSTEMS", label: "EQUIPMENT", description: "Create body layouts and equipment rules.", searchText: "equipment body type slot wearable loadout", onSelect: () => context.pushTask({ type: "feature", feature: "equipment", workspace: "library" }),
}];
