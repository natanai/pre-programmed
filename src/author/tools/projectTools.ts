import type { AuthorToolContributor } from "./types";

export const projectAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "media",
    groupLabel: "WORLD + MEDIA",
    groupOrder: 30,
    toolOrder: 10,
    tool: {
      id: "locations",
      label: "LOCATIONS",
      description: "Navigate the current run or manage saved author locations.",
      searchText: "location locations back previous bookmark bookmarks position current scene checkpoint resume load",
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
      searchText: "player language command commands label aliases grammar prompt settings configuration rules",
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
      searchText: "revision revisions undo change changes restore timeline",
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
      searchText: "export download save database data project",
      onSelect: () => {
        context.closeAll();
        void context.downloadBackup();
      },
    },
  },
];
