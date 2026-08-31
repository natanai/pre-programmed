import type { AuthorFeatureManifest } from "./types";
import { projectAuthorTools } from "../tools/projectTools";
import { WorkspacePanel } from "../workspace/WorkspacePanel";

export const projectAuthorFeature: AuthorFeatureManifest = {
  id: "project",
  tools: projectAuthorTools,
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
      onClose={context.leaveCurrentSurface}
    />;
  },
};
