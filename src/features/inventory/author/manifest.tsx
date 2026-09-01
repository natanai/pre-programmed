import type { AuthorFeatureManifest } from "../../../author/features/types";
import { Inventory } from "../ui/Inventory";
import { ItemEditor } from "./ItemEditor";
import { inventoryAuthorTools } from "./tools";

export const inventoryAuthorFeature: AuthorFeatureManifest = {
  id: "inventory",
  tools: inventoryAuthorTools,
  renderWorkspace(route, context) {
    const inventoryRoute = route.type === "inventory" || (
      route.type === "feature" && route.feature === "inventory" && route.workspace === "inventory"
    );

    if (inventoryRoute) return <Inventory
      snapshot={context.snapshot}
      state={context.playState}
      authorMode={context.authorMode}
      onState={context.runtime.updateState}
      onOutput={context.runtime.output}
      onEvents={context.runtime.events}
      onEditItem={(item) => context.pushPanel({ type: "item", item })}
      onCreateItem={() => context.pushPanel({ type: "item" })}
      onSave={async (operations, description) => {
        await context.persist(operations, description);
      }}
      onClose={context.leaveCurrentSurface}
    />;

    if (route.type === "item") return <ItemEditor
      snapshot={context.snapshot}
      initial={route.item}
      onSave={(operations, description) => context.persist(operations, description)}
      onCancel={context.leaveCurrentSurface}
      setWorkspaceDirty={context.setWorkspaceDirty}
    />;

    return null;
  },
};
