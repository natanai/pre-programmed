import type { AuthorToolContributor } from "../../../author/tools/types";
import type { AuthorSearchContributor } from "../../../author/search/types";

export const valuesAuthorTools: AuthorToolContributor = (context) => [{
  groupId: "systems", groupLabel: "GAME SYSTEMS", groupOrder: 20, toolOrder: 20,
  tool: {
    id: "values", label: "VALUES", description: "Flags, counters, text values, timers, and derived values.",
    searchText: "value values variable variables flag flags counter timer time derived computed state",
    onSelect: () => context.pushTask({ type: "feature", feature: "values", workspace: "library" }),
  },
}];

export const valuesAuthorSearch: AuthorSearchContributor = (context) => [{
  id: "values:library", groupLabel: "GAME SYSTEMS", label: "VALUES",
  description: "Create and edit game values and read-only derived values.",
  searchText: "value values variable flags counter timer derived computed",
  onSelect: () => context.pushTask({ type: "feature", feature: "values", workspace: "library" }),
}];
