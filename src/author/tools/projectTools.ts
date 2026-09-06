import type { AuthorToolContributor } from "./types";

export const projectAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "run",
    groupLabel: "RUN",
    groupOrder: 15,
    toolOrder: 10,
    tool: {
      id: "run-navigation",
      label: "RUN NAVIGATION",
      description: "Move through the current run or manage Author run bookmarks.",
      searchText: "run navigation back previous bookmark bookmarks checkpoint resume load current node play state",
      onSelect: () => context.pushTask({ type: "workspace", view: "navigation" }),
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
      description: "Review authored project revisions and undo the latest project change.",
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
      id: "project-file",
      label: "PROJECT FILE",
      description: "Export or import the portable authored game file.",
      searchText: "project file ppgame export import transfer move portable game",
      onSelect: () => context.pushTask({ type: "feature", feature: "project", workspace: "transfer" }),
    },
  },
  {
    groupId: "project",
    groupLabel: "PROJECT",
    groupOrder: 40,
    toolOrder: 40,
    tool: {
      id: "backup",
      label: "DATABASE BACKUP",
      description: "Download a technical full-database recovery backup.",
      searchText: "backup recovery database raw data emergency",
      onSelect: () => {
        context.closeAll();
        void context.downloadBackup();
      },
    },
  },
];
