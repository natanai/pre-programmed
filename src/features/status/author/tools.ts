import type { AuthorSearchContributor } from "../../../author/search/types";
import type { AuthorToolContributor } from "../../../author/tools/types";

export const statusAuthorTools: AuthorToolContributor = (context) => [{
  groupId: "systems", groupLabel: "GAME SYSTEMS", groupOrder: 20, toolOrder: 30,
  tool: {
    id: "status", label: "PLAYER STATUS", description: "Choose which game values players can see and how they are grouped.",
    searchText: "status stats attributes relationships reputation player visible groups",
    onSelect: () => context.pushTask({ type: "feature", feature: "status", workspace: "library" }),
  },
}];

export const statusAuthorSearch: AuthorSearchContributor = (context) => [{
  id: "status:library", groupLabel: "GAME SYSTEMS", label: "PLAYER STATUS",
  description: "Build player-visible information groups from authored values.",
  searchText: "status stats attributes relationship relationships reputation visible",
  onSelect: () => context.pushTask({ type: "feature", feature: "status", workspace: "library" }),
}];
