import type { AuthorFeatureManifest } from "../../../author/features/types";
import { WORLD_COMMAND_REFERENCE_SOURCES } from "../commandReferences";
import { WORLD_AUTHOR_OPERATION_DEFINITIONS } from "../operationAdapter";
import { WORLD_WORKSPACES } from "./entityWorkspaces";
import { worldAuthorSearch, worldAuthorTools } from "./tools";
import { worldProjectReferences } from "./references";

function entityRoute(type: "character" | "location", id?: string, resourceTask = false) {
  return { type: "feature" as const, feature: "world", workspace: "entity", data: { entityType: type, ...(id ? { resourceId: id } : {}), ...(resourceTask ? { resourceTask: type } : {}) } };
}

export const worldAuthorFeature: AuthorFeatureManifest = {
  id: "world",
  commandReferences: WORLD_COMMAND_REFERENCE_SOURCES,
  operations: WORLD_AUTHOR_OPERATION_DEFINITIONS,
  workspaces: WORLD_WORKSPACES,
  tools: worldAuthorTools,
  search: worldAuthorSearch,
  references: [worldProjectReferences],
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "world") return null;
    if (route.workspace === "library") return "People + places";
    const entity = snapshot.entities.find((candidate) => candidate.id === route.data?.resourceId);
    return entity?.name || entity?.key || `New ${route.data?.entityType ?? "world entry"}`;
  },
  commandTargets: [
    {
      sourceKind: "world.character", label: "character",
      list: (snapshot, operation) => snapshot.entities.filter((entity) => entity.type === "character").map((entity) => ({ id: entity.id, label: entity.name || entity.key, available: (entity.operations ?? []).includes(operation), responseCount: (entity.hooks ?? []).filter((hook) => hook.operation === operation).length })),
      editRoute: (id, operation) => ({ type: "feature", feature: "world", workspace: "entity", data: { entityType: "character", resourceId: id, preferredOperation: operation } }),
      createRoute: (operation) => ({ type: "feature", feature: "world", workspace: "entity", data: { entityType: "character", preferredOperation: operation } }),
    },
    {
      sourceKind: "world.location", label: "location",
      list: (snapshot, operation) => snapshot.entities.filter((entity) => entity.type === "location").map((entity) => ({ id: entity.id, label: entity.name || entity.key, available: (entity.operations ?? []).includes(operation), responseCount: (entity.hooks ?? []).filter((hook) => hook.operation === operation).length })),
      editRoute: (id, operation) => ({ type: "feature", feature: "world", workspace: "entity", data: { entityType: "location", resourceId: id, preferredOperation: operation } }),
      createRoute: (operation) => ({ type: "feature", feature: "world", workspace: "entity", data: { entityType: "location", preferredOperation: operation } }),
    },
  ],
  resources: [
    { kind: "character", label: "Character", pluralLabel: "Characters", list: (snapshot) => snapshot.entities.filter((item) => item.type === "character").map((item) => ({ id: item.id, value: item.id, label: item.name || item.key, detail: item.key })), createRoute: () => entityRoute("character", undefined, true), editRoute: (resource) => entityRoute("character", resource.id, true) },
    { kind: "location", label: "Location", pluralLabel: "Locations", list: (snapshot) => snapshot.entities.filter((item) => item.type === "location").map((item) => ({ id: item.id, value: item.id, label: item.name || item.key, detail: item.key })), createRoute: () => entityRoute("location", undefined, true), editRoute: (resource) => entityRoute("location", resource.id, true) },
  ],
};
