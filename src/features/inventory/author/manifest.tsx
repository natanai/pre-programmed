import type { AuthorFeatureManifest } from "../../../author/features/types";
import { Inventory } from "../ui/Inventory";
import { BodyTypeEditor } from "./BodyBackgroundEditor";
import { inventoryItemWorkspaces } from "./itemWorkspaces";
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

export const inventoryAuthorFeature: AuthorFeatureManifest = {
  id: "inventory",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "inventory") return null;
    if (route.workspace === "inventory") return "Inventory + body";
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
    editRoute: (id, operation) => ({ type: "feature", feature: "inventory", workspace: "item", data: { itemId: id, section: "operations", operation, resourceTask: "item" } }),
    createRoute: (operation) => ({ type: "feature", feature: "inventory", workspace: "item", data: { section: "operations", operation, resourceTask: "item" } }),
  }],
  operations: INVENTORY_OPERATION_DEFINITIONS,
  conditions: [hasItemConditionAdapter, lacksItemConditionAdapter],
  effects: [giveItemEffectAdapter, removeItemEffectAdapter, setItemStateEffectAdapter, setBodyBackgroundEffectAdapter],
  references: [inventoryProjectReferences],
  tools: inventoryAuthorTools,
  search: inventoryAuthorSearch,
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
      createRoute: () => ({
        type: "feature",
        feature: "inventory",
        workspace: "item",
        data: { resourceTask: "item" },
      }),
      editRoute: (resource) => ({
        type: "feature",
        feature: "inventory",
        workspace: "item",
        data: { itemId: resource.id, resourceTask: "item" },
      }),
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
      createRoute: () => ({
        type: "feature",
        feature: "inventory",
        workspace: "body-type",
        data: { resourceTask: "body-type" },
      }),
      editRoute: (resource) => ({
        type: "feature",
        feature: "inventory",
        workspace: "body-type",
        data: { bodyTypeId: resource.id, resourceTask: "body-type" },
      }),
    },
  ],
  workspaces: inventoryItemWorkspaces,
  renderWorkspace(route, context) {
    if (route.type === "feature" && route.feature === "inventory" && route.workspace === "inventory") return <Inventory
      snapshot={context.snapshot}
      state={context.playState}
      authorMode={context.authorMode}
      onState={context.runtime.updateState}
      onOutput={context.runtime.output}
      onEvents={context.runtime.events}
      onEditItem={(item) => context.pushTask({
        type: "feature",
        feature: "inventory",
        workspace: "item",
        data: { itemId: item.id },
      })}
      onCreateItem={() => context.pushTask({
        type: "feature",
        feature: "inventory",
        workspace: "item",
      })}
      onEditBodyBackground={(bodyType) => context.pushTask({
        type: "feature",
        feature: "inventory",
        workspace: "body-type",
        data: { bodyTypeId: bodyType.id },
      })}
      onCreateBodyBackground={() => context.pushTask({
        type: "feature",
        feature: "inventory",
        workspace: "body-type",
      })}
      onSave={async (operations, description) => {
        await context.persist(operations, description);
      }}
      onClose={context.leaveCurrentTask}
    />;

    if (route.type === "feature" && route.feature === "inventory" && route.workspace === "body-type") {
      const bodyType = route.data?.bodyTypeId
        ? (context.snapshot.bodyBackgrounds ?? []).find((candidate) => candidate.id === route.data?.bodyTypeId)
        : undefined;
      const resourceTask = route.data?.resourceTask === "body-type";
      return <BodyTypeEditor
        snapshot={context.snapshot}
        initial={bodyType}
        onSave={async (operations, description) => {
          const result = await context.persist(operations, description);
          if (resourceTask && (result.status === "saved" || result.status === "queued")) {
            const operation = operations.find((candidate) => candidate.type === "bodyBackground.upsert");
            if (operation?.type === "bodyBackground.upsert") context.completeTask({
              type: "resource",
              kind: "body-type",
              id: operation.background.id,
              value: operation.background.id,
              label: operation.background.name || "Untitled body type",
            });
          }
          return result;
        }}
        onCancel={context.leaveCurrentTask}
        setWorkspaceDirty={context.setWorkspaceDirty}
      />;
    }

    return null;
  },
};
