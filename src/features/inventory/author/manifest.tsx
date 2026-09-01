import type { AuthorFeatureManifest } from "../../../author/features/types";
import { Inventory } from "../ui/Inventory";
import { BodyBackgroundEditor } from "./BodyBackgroundEditor";
import { ItemEditor } from "./ItemEditor";
import { inventoryAuthorTools } from "./tools";

export const inventoryAuthorFeature: AuthorFeatureManifest = {
  id: "inventory",
  tools: inventoryAuthorTools,
  renderWorkspace(route, context) {
    if (route.type === "feature" && route.feature === "inventory" && route.workspace === "inventory") return <Inventory
      snapshot={context.snapshot}
      state={context.playState}
      authorMode={context.authorMode}
      onState={context.runtime.updateState}
      onOutput={context.runtime.output}
      onEvents={context.runtime.events}
      onEditItem={(item) => context.pushPanel({
        type: "feature",
        feature: "inventory",
        workspace: "item",
        data: { itemId: item.id },
      })}
      onCreateItem={() => context.pushPanel({
        type: "feature",
        feature: "inventory",
        workspace: "item",
      })}
      onEditBodyBackground={(background) => context.pushPanel({
        type: "feature",
        feature: "inventory",
        workspace: "body-background",
        data: { backgroundId: background.id },
      })}
      onCreateBodyBackground={() => context.pushPanel({
        type: "feature",
        feature: "inventory",
        workspace: "body-background",
      })}
      onSave={async (operations, description) => {
        await context.persist(operations, description);
      }}
      onClose={context.leaveCurrentSurface}
    />;

    if (route.type === "feature" && route.feature === "inventory" && route.workspace === "item") {
      const item = route.data?.itemId
        ? context.snapshot.items.find((candidate) => candidate.id === route.data?.itemId)
        : undefined;
      return <ItemEditor
        snapshot={context.snapshot}
        initial={item}
        onSave={(operations, description) => context.persist(operations, description)}
        onCancel={context.leaveCurrentSurface}
        setWorkspaceDirty={context.setWorkspaceDirty}
      />;
    }

    if (route.type === "feature" && route.feature === "inventory" && route.workspace === "body-background") {
      const background = route.data?.backgroundId
        ? (context.snapshot.bodyBackgrounds ?? []).find((candidate) => candidate.id === route.data?.backgroundId)
        : undefined;
      return <BodyBackgroundEditor
        snapshot={context.snapshot}
        initial={background}
        onSave={(operations, description) => context.persist(operations, description)}
        onCancel={context.leaveCurrentSurface}
        setWorkspaceDirty={context.setWorkspaceDirty}
      />;
    }

    return null;
  },
};
