import type { AuthorToolContributor } from "../../../author/tools/types";
import type { AuthorSearchContributor } from "../../../author/search/types";

export const stateAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "systems",
    groupLabel: "GAME SYSTEMS",
    groupOrder: 20,
    toolOrder: 20,
    tool: {
      id: "definitions",
      label: "STATE + PEOPLE",
      description: "Variables, computed values, characters, and locations.",
      searchText: "state variable flag counter timer time computed value person people character speaker location world label",
      onSelect: () => context.pushTask({ type: "feature", feature: "state", workspace: "definitions" }),
    },
  },
];

export const stateAuthorSearch: AuthorSearchContributor = (context) => [
  {
    id: "state:definitions",
    groupLabel: "GAME SYSTEMS",
    label: "STATE, PEOPLE + PLACES",
    description: "Find or create variables, flags, computed values, characters, and locations.",
    searchText: "variable variables flag flags number counter timer time computed value values character characters speaker person people location locations place places label",
    onSelect: () => context.pushTask({ type: "feature", feature: "state", workspace: "definitions" }),
  },
];
