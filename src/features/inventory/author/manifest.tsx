import type { AuthorFeatureManifest } from "../../../author/features/types";
import { Inventory } from "../ui/Inventory";
import { BodyTypeEditor } from "./BodyBackgroundEditor";
import { ItemEditor } from "./ItemEditor";
import { inventoryAuthorTools } from "./tools";

export const inventoryAuthorFeature: AuthorFeatureManifest = {
  id: "inventory",
  tools: inventoryAuthorTools,
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

    if (route.type === "feature" && route.feature === "inventory" && route.workspace === "item") {
      const item = route.data?.itemId
        ? context.snapshot.items.find((candidate) => candidate.id === route.data?.itemId)
        : undefined;
      const resourceTask = route.data?.resourceTask === "item";
      return <ItemEditor
        snapshot={context.snapshot}
        initial={item}
        onSave={async (operations, description) => {
          const result = await context.persist(operations, description);
          if (resourceTask && (result.status === "saved" || result.status === "queued")) {
            const operation = operations.find((candidate) => candidate.type === "item.upsert");
            if (operation?.type === "item.upsert") context.completeTask({
              type: "resource",
              kind: "item",
              id: operation.item.id,
              value: operation.item.id,
              label: operation.item.name || operation.item.key || "Untitled item",
            });
          }
          return result;
        }}
        onCancel={context.leaveCurrentTask}
        setWorkspaceDirty={context.setWorkspaceDirty}
      />;
    }

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
