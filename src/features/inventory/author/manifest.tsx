import type { AuthorFeatureManifest } from "../../../author/features/types";
import { inventoryAuthorSearch, inventoryAuthorTools } from "./tools";
import { INVENTORY_COMMAND_REFERENCE_SOURCES } from "../commandReferences";
import { INVENTORY_OPERATION_DEFINITIONS } from "../operationAdapter";
import {
  giveItemEffectAdapter,
  hasItemConditionAdapter,
  lacksItemConditionAdapter,
  removeItemEffectAdapter,
  setBodyBackgroundEffectAdapter,
  setItemStateEffectAdapter,
} from "./ruleAdapters";
import { inventoryProjectReferences } from "./references";
import { BODY_WORKSPACES } from "./bodyWorkspaces";
import { INVENTORY_EQUIPMENT_WORKSPACES } from "./equipmentWorkspaces";
import { INVENTORY_WORKSPACES, inventoryRoute } from "./workspaces";

export const inventoryAuthorFeature: AuthorFeatureManifest = {
  id: "inventory",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "inventory") return null;
    if (route.workspace === "inventory") return "Inventory";
    if (route.workspace === "items") return "Item definitions";
    if (route.workspace === "body-types") return "Body types";
    if (route.workspace === "item") {
      const item = snapshot.items.find((candidate) => candidate.id === route.data?.itemId);
      const operation = route.data?.operation;
      const label = item?.name || item?.key || "New item";
      return operation ? `${label} · ${operation}` : label;
    }
    if (route.workspace === "item-equipment") return `${route.data?.itemName || "Item"} · equipment`;
    if (route.workspace === "item-equipment-placement") return `${route.data?.itemName || "Item"} · placement`;
    if (route.workspace === "body-type") {
      const bodyType = (snapshot.bodyBackgrounds ?? []).find((candidate) => candidate.id === route.data?.bodyTypeId);
      return bodyType?.name || "New body type";
    }
    if (route.workspace === "body-slot") return route.data?.slotName || "Body slot";
    return null;
  },
  commandReferences: INVENTORY_COMMAND_REFERENCE_SOURCES,
  commandTargets: [{
    sourceKind: "inventory.item",
    label: "item",
    list: (snapshot, operation) => snapshot.items.map((item) => ({
      id: item.id,
      label: item.name || item.key || "Untitled item",
      detail: item.key,
      available: (item.operations ?? []).includes(operation),
      responseCount: (item.hooks ?? []).filter((hook) => hook.operation === operation).length,
    })),
    editRoute: (id, operation) => inventoryRoute("item", id, true, operation),
    createRoute: (operation) => inventoryRoute("item", undefined, true, operation),
  }],
  operations: INVENTORY_OPERATION_DEFINITIONS,
  conditions: [hasItemConditionAdapter, lacksItemConditionAdapter],
  effects: [giveItemEffectAdapter, removeItemEffectAdapter, setItemStateEffectAdapter, setBodyBackgroundEffectAdapter],
  references: [inventoryProjectReferences],
  tools: inventoryAuthorTools,
  search: inventoryAuthorSearch,
  workspaces: [...INVENTORY_WORKSPACES, ...INVENTORY_EQUIPMENT_WORKSPACES, ...BODY_WORKSPACES],
  resources: [
    {
      kind: "item",
      label: "Item",
      pluralLabel: "Items",
      list: (snapshot) => snapshot.items.map((item) => ({
        id: item.id,
        value: item.id,
        label: item.name || item.key || "Untitled item",
        detail: item.key,
      })),
      createRoute: () => inventoryRoute("item", undefined, true),
      editRoute: (resource) => inventoryRoute("item", resource.id, true),
    },
    {
      kind: "body-type",
      label: "Body Type",
      pluralLabel: "Body Types",
      list: (snapshot) => (snapshot.bodyBackgrounds ?? []).map((bodyType) => ({
        id: bodyType.id,
        value: bodyType.id,
        label: bodyType.name || "Untitled body type",
      })),
      createRoute: () => inventoryRoute("body-type", undefined, true),
      editRoute: (resource) => inventoryRoute("body-type", resource.id, true),
    },
  ],
};
