import type { AuthorToolContributor } from "../../../author/tools/types";

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
      onSelect: () => context.pushTask({ type: "feature", feature: "state", workspace: "definitions" }),
    },
  },
];
