import type { AuthorFeatureManifest } from "./types";
import { PROJECT_GENERAL_SETTINGS } from "../settings/projectGeneralSettings";
import { projectAuthorTools } from "../tools/projectTools";
import { WorkspacePanel } from "../workspace/WorkspacePanel";
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
    if (route.type === "workspace") return route.view === "history" ? "History" : "Locations";
    if (route.type === "feature" && route.feature === "project" && route.workspace === "settings") return "Advanced settings";
    return null;
  },
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
  projectSettings: PROJECT_GENERAL_SETTINGS,
  renderWorkspace(route, context) {
    if (route.type !== "workspace") return null;
    return <WorkspacePanel
      token={context.authorToken}
      snapshot={context.snapshot}
      playState={context.playState}
      initialView={route.view}
      onSave={async (operations, description) => {
        await context.persist(operations, description);
      }}
      onSnapshot={context.onSnapshot}
      onRestore={context.onRestore}
      onClose={context.leaveCurrentTask}
    />;
  },
};
