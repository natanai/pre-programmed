import type { AuthorFeatureManifest } from "../../../author/features/types";
import { INVENTORY_COMMAND_REFERENCE_SOURCES } from "../commandReferences";
import { INVENTORY_OPERATION_DEFINITIONS } from "../operationAdapter";
import { INVENTORY_WORKSPACES } from "./workspaces";
import { inventoryAuthorSearch, inventoryAuthorTools } from "./tools";
import { inventoryProjectReferences } from "./references";
import { giveItemEffectAdapter, hasItemConditionAdapter, lacksItemConditionAdapter, removeItemEffectAdapter, setItemStateEffectAdapter } from "./ruleAdapters";

function itemRoute(id?: string, resourceTask = false) {
  return { type: "feature" as const, feature: "inventory", workspace: "item", data: { ...(id ? { itemId: id } : {}), ...(resourceTask ? { resourceTask: "item" } : {}) } };
}

export const inventoryAuthorFeature: AuthorFeatureManifest = {
  id: "inventory",
  commandReferences: INVENTORY_COMMAND_REFERENCE_SOURCES,
  operations: INVENTORY_OPERATION_DEFINITIONS,
  conditions: [hasItemConditionAdapter, lacksItemConditionAdapter],
  effects: [giveItemEffectAdapter, removeItemEffectAdapter, setItemStateEffectAdapter],
  references: [inventoryProjectReferences],
  tools: inventoryAuthorTools,
  search: inventoryAuthorSearch,
  workspaces: INVENTORY_WORKSPACES,
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "inventory") return null;
    if (route.workspace === "inventory") return "Inventory";
    if (route.workspace === "library") return "Inventory authoring";
    if (route.workspace === "presentation") return "Inventory presentation";
    if (route.workspace === "item") return snapshot.items.find((item) => item.id === route.data?.itemId)?.name || "New item";
    return null;
  },
  commandTargets: [{
    sourceKind: "inventory.item", label: "item",
    list: (snapshot, operation) => snapshot.items.map((item) => ({ id: item.id, label: item.name || item.key, detail: item.key, available: (item.operations ?? []).includes(operation), responseCount: (item.hooks ?? []).filter((hook) => hook.operation === operation).length })),
    editRoute: (id, operation) => ({ type: "feature", feature: "inventory", workspace: "item", data: { itemId: id, preferredOperation: operation } }),
    createRoute: (operation) => ({ type: "feature", feature: "inventory", workspace: "item", data: { preferredOperation: operation } }),
  }],
  resources: [{
    kind: "item", label: "Item", pluralLabel: "Items",
    list: (snapshot) => snapshot.items.map((item) => ({ id: item.id, value: item.id, label: item.name || item.key || "Untitled item", detail: item.key })),
    createRoute: () => itemRoute(undefined, true), editRoute: (resource) => itemRoute(resource.id, true),
  }],
};
