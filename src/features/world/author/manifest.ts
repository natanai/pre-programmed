import type { AuthorFeatureManifest } from "../../../author/features/types";
import { WORLD_AUTHOR_OPERATION_DEFINITIONS } from "../operationAdapter";
import { targetDescriptionEffectAdapter, targetPortraitEffectAdapter } from "./ruleAdapters";
import { WORLD_WORKSPACES, worldEntityRoute } from "./entityWorkspaces";
import { worldProjectReferences } from "./references";

const WORLD_LIBRARY_ROUTE = { type: "feature", feature: "world", workspace: "library" } as const;

export const worldAuthorFeature: AuthorFeatureManifest = {
  id: "world",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "world") return null;
    if (route.workspace === "library") return "People + places";
    if (route.workspace === "entity") {
      const entity = snapshot.entities.find((candidate) => candidate.id === route.data?.resourceId);
      return entity?.name || `New ${route.data?.entityType === "location" ? "location" : "character"}`;
    }
    return null;
  },
  terminalShortcuts: [{ commands: ["/locations", "locations"], route: WORLD_LIBRARY_ROUTE }],
  operations: WORLD_AUTHOR_OPERATION_DEFINITIONS,
  effects: [targetDescriptionEffectAdapter, targetPortraitEffectAdapter],
  references: [worldProjectReferences],
  workspaces: [...WORLD_WORKSPACES],
  commandTargets: [
    {
      sourceKind: "world.character",
      label: "character",
      list: (snapshot, operation) => snapshot.entities.filter((entity) => entity.type === "character").map((entity) => ({
        id: entity.id,
        label: entity.name || entity.key || "Untitled character",
        available: (entity.operations ?? []).includes(operation),
        responseCount: (entity.hooks ?? []).filter((hook) => hook.operation === operation).length,
      })),
      editRoute: (id, operation) => worldEntityRoute("character", id, true, operation),
      createRoute: (operation) => worldEntityRoute("character", undefined, true, operation),
    },
    {
      sourceKind: "world.location",
      label: "location",
      list: (snapshot, operation) => snapshot.entities.filter((entity) => entity.type === "location").map((entity) => ({
        id: entity.id,
        label: entity.name || entity.key || "Untitled location",
        available: (entity.operations ?? []).includes(operation),
        responseCount: (entity.hooks ?? []).filter((hook) => hook.operation === operation).length,
      })),
      editRoute: (id, operation) => worldEntityRoute("location", id, true, operation),
      createRoute: (operation) => worldEntityRoute("location", undefined, true, operation),
    },
  ],
  resources: [
    {
      kind: "character",
      label: "Character",
      pluralLabel: "Characters",
      list: (snapshot) => snapshot.entities.filter((item) => item.type === "character").map((item) => ({ id: item.id, value: item.id, label: item.name || item.key, detail: item.key })),
      listRoute: () => WORLD_LIBRARY_ROUTE,
      createRoute: () => worldEntityRoute("character", undefined, true),
      editRoute: (resource) => worldEntityRoute("character", resource.id, true),
    },
    {
      kind: "location",
      label: "Location",
      pluralLabel: "Locations",
      list: (snapshot) => snapshot.entities.filter((item) => item.type === "location").map((item) => ({ id: item.id, value: item.id, label: item.name || item.key, detail: item.key })),
      listRoute: () => WORLD_LIBRARY_ROUTE,
      createRoute: () => worldEntityRoute("location", undefined, true),
      editRoute: (resource) => worldEntityRoute("location", resource.id, true),
    },
  ],
  tools: (context) => [{
    groupId: "systems",
    groupLabel: "GAME SYSTEMS",
    groupOrder: 20,
    toolOrder: 22,
    tool: {
      id: "people-places",
      label: "PEOPLE + PLACES",
      description: "Characters, speakers, locations, and world entities.",
      searchText: "person people character characters speaker speakers location locations place places world",
      onSelect: () => context.pushTask(WORLD_LIBRARY_ROUTE),
    },
  }],
  search: (context) => [{
    id: "world:library",
    groupLabel: "GAME SYSTEMS",
    label: "PEOPLE + PLACES",
    description: "Find or create characters and locations.",
    searchText: "character characters speaker person people location locations place places world",
    onSelect: () => context.pushTask(WORLD_LIBRARY_ROUTE),
  }],
};
