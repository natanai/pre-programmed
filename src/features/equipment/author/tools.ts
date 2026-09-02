import type { AuthorSearchContributor } from "../../../author/search/types";
import type { AuthorToolContributor } from "../../../author/tools/types";

const openEquipment = (context: Parameters<AuthorToolContributor>[0]) => () => context.pushTask({ type: "feature", feature: "equipment", workspace: "library" });

export const equipmentAuthorTools: AuthorToolContributor = (context) => [{
  groupId: "systems", groupLabel: "GAME SYSTEMS", groupOrder: 20, toolOrder: 50,
  tool: { id: "equipment", label: "EQUIPMENT + BODY TYPES", description: "Body types, body-slot layouts, equipment rules, and starting loadouts.", searchText: "equipment equip body bodies body type body types slot slots wearable loadout", onSelect: openEquipment(context) },
}];

export const equipmentAuthorSearch: AuthorSearchContributor = (context) => [{
  id: "equipment:library", groupLabel: "GAME SYSTEMS", label: "EQUIPMENT", description: "Create equipment rules and starting loadouts.", searchText: "equipment wearable loadout equip", onSelect: openEquipment(context),
}, {
  id: "equipment:body-types", groupLabel: "GAME SYSTEMS", label: "BODY TYPES", description: "Create body images and physical equipment-slot layouts.", searchText: "body body type body types slot slots anatomy equipment", onSelect: openEquipment(context),
}];
