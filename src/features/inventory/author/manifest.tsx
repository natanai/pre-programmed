import type { AuthorFeatureManifest } from "../../../author/features/types";
import { Inventory } from "../ui/Inventory";
import { ItemEditor } from "./ItemEditor";
import { inventoryAuthorTools } from "./tools";

export const inventoryAuthorFeature: AuthorFeatureManifest = {
  id: "inventory",
  tools: inventoryAuthorTools,
  renderWorkspace(route, context) {
    if (route.type === "inventory") return <Inventory
      snapshot={context.snapshot}
      state={context.playState}
      authorMode={context.authorMode}
      onState={context.onInventoryState}
      onOutput={context.onInventoryOutput}
      onEvents={context.onEvents}
      onEditItem={(item) => context.pushPanel({ type: "item", item })}
      onCreateItem={() => context.pushPanel({ type: "item" })}
      onSave={context.persist}
      onClose={context.leaveCurrentSurface}
    />;

    if (route.type === "item") return <ItemEditor
      snapshot={context.snapshot}
      initial={route.item}
      onSave={context.persist}
      onCancel={context.leaveCurrentSurface}
      onDirtyChange={context.onWorkspaceDirtyChange}
    />;

    return null;
  },
};
