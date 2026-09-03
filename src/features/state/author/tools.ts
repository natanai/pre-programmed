import type { AuthorToolContributor } from "../../../author/tools/types";
import type { AuthorSearchContributor } from "../../../author/search/types";

export const stateAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "systems",
    groupLabel: "GAME SYSTEMS",
    groupOrder: 20,
    toolOrder: 20,
    tool: {
      id: "state-definitions",
      label: "STATE",
      description: "Variables, computed values, and player-visible value groups.",
      searchText: "state variable variables flag flags counter timer time computed value values stats attributes relationship reputation status group",
      onSelect: () => context.pushTask({ type: "feature", feature: "state", workspace: "definitions" }),
    },
  },
  {
    groupId: "systems",
    groupLabel: "GAME SYSTEMS",
    groupOrder: 20,
    toolOrder: 21,
    tool: {
      id: "player-status",
      label: "PLAYER STATUS",
      description: "Preview the State groups currently visible to the player.",
      searchText: "player status stats attributes relationship reputation visible values",
      onSelect: () => context.pushTask({ type: "feature", feature: "state", workspace: "status" }),
    },
  },
];

export const stateAuthorSearch: AuthorSearchContributor = (context) => [
  {
    id: "state:definitions",
    groupLabel: "GAME SYSTEMS",
    label: "STATE",
    description: "Find or create variables, flags, computed values, and player groups.",
    searchText: "variable variables flag flags number counter timer time computed value values state stats attributes relationships reputation",
    onSelect: () => context.pushTask({ type: "feature", feature: "state", workspace: "definitions" }),
  },
  {
    id: "state:status",
    groupLabel: "GAME SYSTEMS",
    label: "PLAYER STATUS",
    description: "Preview visible State groups.",
    searchText: "status stats player visible groups attributes relationships reputation",
    onSelect: () => context.pushTask({ type: "feature", feature: "state", workspace: "status" }),
  },
];
