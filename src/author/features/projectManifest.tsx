import type { AuthorFeatureManifest } from "./types";
import { PROJECT_GENERAL_SETTINGS } from "../settings/projectGeneralSettings";
import { projectTransferAuthorWorkspace } from "../project/projectTransferWorkspace";
import { projectAuthorTools } from "../tools/projectTools";
import {
  allConditionAdapter,
  alwaysConditionAdapter,
  anyConditionAdapter,
  attemptConditionAdapter,
  notConditionAdapter,
  notificationEffectAdapter,
  runtimeStateConditionAdapter,
} from "../rules/coreAdapters";

export const projectAuthorFeature: AuthorFeatureManifest = {
  id: "project",
  describeTask(route) {
    if (route.type === "feature" && route.feature === "project" && route.workspace === "settings") return "Advanced settings";
    if (route.type === "feature" && route.feature === "project" && route.workspace === "transfer") return "Project file";
    return null;
  },
  terminalShortcuts: [
    {
      commands: ["/run", "run", "/navigation", "navigation", "/bookmark", "bookmarks"],
      route: { type: "workspace", view: "navigation" },
    },
    {
      commands: ["/history", "history"],
      route: { type: "workspace", view: "history" },
    },
  ],
  resources: [{
    kind: "project-terminal",
    label: "Terminal Prompt",
    pluralLabel: "Terminal Prompt",
    searchable: false,
    list: (snapshot) => [{
      id: "terminal",
      value: "terminal",
      label: snapshot.settings.terminalPrompt || "Terminal prompt",
      detail: "Project terminal setting",
    }],
    editRoute: () => ({
      type: "feature",
      feature: "project",
      workspace: "settings",
      data: { section: "project-terminal" },
    }),
  }],
  conditions: [
    alwaysConditionAdapter,
    allConditionAdapter,
    anyConditionAdapter,
    notConditionAdapter,
    attemptConditionAdapter,
    runtimeStateConditionAdapter,
  ],
  effects: [notificationEffectAdapter],
  tools: projectAuthorTools,
  workspaces: [projectTransferAuthorWorkspace],
  projectSettings: PROJECT_GENERAL_SETTINGS,
};
