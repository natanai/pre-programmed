import type { AuthorToolContributor } from "./types";

export const projectAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "media",
    groupLabel: "WORLD + MEDIA",
    groupOrder: 30,
    toolOrder: 10,
    tool: {
      id: "locations",
      label: "SAVED LOCATIONS",
      description: "Save or restore a play location while authoring.",
      onSelect: () => context.pushTask({ type: "workspace", view: "locations" }),
    },
  },
  {
    groupId: "project",
    groupLabel: "PROJECT",
    groupOrder: 40,
    toolOrder: 10,
    tool: {
      id: "settings",
      label: "ADVANCED SETTINGS",
      description: "Configure project-wide engine behavior, references, and terminal grammar.",
      onSelect: () => context.pushTask({ type: "feature", feature: "project", workspace: "settings" }),
    },
  },
  {
    groupId: "project",
    groupLabel: "PROJECT",
    groupOrder: 40,
    toolOrder: 20,
    tool: {
      id: "history",
      label: "HISTORY",
      description: "Review revisions and project history.",
      onSelect: () => context.pushTask({ type: "workspace", view: "history" }),
    },
  },
  {
    groupId: "project",
    groupLabel: "PROJECT",
    groupOrder: 40,
    toolOrder: 30,
    tool: {
      id: "backup",
      label: "BACKUP",
      description: "Download a complete project backup.",
      onSelect: () => {
        context.closeAll();
        void context.downloadBackup();
      },
    },
  },
];
