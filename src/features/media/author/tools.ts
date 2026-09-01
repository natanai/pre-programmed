import type { AuthorToolContributor } from "../../../author/tools/types";

export const mediaAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "media",
    groupLabel: "WORLD + MEDIA",
    groupOrder: 30,
    toolOrder: 20,
    tool: {
      id: "assets",
      label: "ASSETS",
      description: "Browse detected repository art and audio.",
      onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "assets" }),
    },
  },
  {
    groupId: "media",
    groupLabel: "WORLD + MEDIA",
    groupOrder: 30,
    toolOrder: 30,
    tool: {
      id: "sound",
      label: "SOUND",
      description: "Create and edit synthesized sounds.",
      onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "synth" }),
    },
  },
];
