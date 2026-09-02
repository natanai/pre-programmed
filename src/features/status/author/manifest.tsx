import type { AuthorFeatureManifest } from "../../../author/features/types";
import { STATUS_WORKSPACES } from "./workspaces";
import { statusAuthorSearch, statusAuthorTools } from "./tools";
import { statusProjectReferences } from "./references";

export const statusAuthorFeature: AuthorFeatureManifest = {
  id: "status",
  tools: statusAuthorTools,
  search: statusAuthorSearch,
  references: [statusProjectReferences],
  workspaces: STATUS_WORKSPACES,
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "status") return null;
    if (route.workspace === "library") return "Player status";
    if (route.workspace === "group") return snapshot.statusGroups.find((group) => group.id === route.data?.groupId)?.label || "New status group";
    if (route.workspace === "entry") return snapshot.statusEntries.find((entry) => entry.id === route.data?.entryId)?.label || "Status entry";
    return null;
  },
  terminalShortcuts: [{ commands: ["/status"], route: { type: "feature", feature: "status", workspace: "library" } }],
};
