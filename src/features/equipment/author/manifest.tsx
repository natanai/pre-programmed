import type { AuthorFeatureManifest } from "../../../author/features/types";
import { EQUIPMENT_OPERATION_DEFINITIONS } from "../operationDefinitions";
import { setBodyTypeEffectAdapter } from "./ruleAdapters";
import { equipmentPlayerWorkspace } from "./playerWorkspace";
import { EQUIPMENT_WORKSPACES } from "./workspaces";
import { equipmentAuthorSearch, equipmentAuthorTools } from "./tools";
import { equipmentProjectReferences } from "./references";

function bodyRoute(id?: string, resourceTask = false) {
  return { type: "feature" as const, feature: "equipment", workspace: "body-type", data: { ...(id ? { bodyTypeId: id } : {}), ...(resourceTask ? { resourceTask: "body-type" } : {}) } };
}

export const equipmentAuthorFeature: AuthorFeatureManifest = {
  id: "equipment",
  operations: EQUIPMENT_OPERATION_DEFINITIONS,
  effects: [setBodyTypeEffectAdapter],
  workspaces: [equipmentPlayerWorkspace, ...EQUIPMENT_WORKSPACES],
  tools: equipmentAuthorTools,
  search: equipmentAuthorSearch,
  references: [equipmentProjectReferences],
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "equipment") return null;
    if (route.workspace === "equipment") return "Equipment";
    if (route.workspace === "library") return "Equipment";
    if (route.workspace === "body-type") return snapshot.bodyTypes.find((bodyType) => bodyType.id === route.data?.bodyTypeId)?.name || "New body type";
    if (route.workspace === "slot") return "Equipment slot";
    if (route.workspace === "rule") return snapshot.items.find((item) => item.id === route.data?.itemId)?.name || "Equipment rule";
    if (route.workspace === "settings") return "Starting body";
    return null;
  },
  resources: [{
    kind: "body-type",
    label: "Body Type",
    pluralLabel: "Body Types",
    list: (snapshot) => snapshot.bodyTypes.map((bodyType) => ({ id: bodyType.id, value: bodyType.id, label: bodyType.name || "Untitled body type" })),
    createRoute: () => bodyRoute(undefined, true),
    editRoute: (resource) => bodyRoute(resource.id, true),
  }],
};
