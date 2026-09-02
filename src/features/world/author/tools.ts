import type { AuthorSearchContributor } from "../../../author/search/types";
import type { AuthorToolContributor } from "../../../author/tools/types";

export const worldAuthorTools: AuthorToolContributor = (context) => [{
  groupId: "world", groupLabel: "WORLD", groupOrder: 15, toolOrder: 10,
  tool: {
    id: "people-places", label: "PEOPLE + PLACES", description: "Characters and locations in the game world.",
    searchText: "world character characters people person speaker location locations place places",
    onSelect: () => context.pushTask({ type: "feature", feature: "world", workspace: "library" }),
  },
}];

export const worldAuthorSearch: AuthorSearchContributor = (context) => [{
  id: "world:library", groupLabel: "WORLD", label: "PEOPLE + PLACES", description: "Create and edit characters and locations.",
  searchText: "character characters speaker person people location locations place places world",
  onSelect: () => context.pushTask({ type: "feature", feature: "world", workspace: "library" }),
}];
