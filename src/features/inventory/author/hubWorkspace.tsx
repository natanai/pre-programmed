import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { normalizeBodyTypeDefinition } from "../bodyCanvas";
import { inventoryRoute } from "./workspaces";
import "./inventoryWorkspaces.css";

export const inventoryAuthorHubWorkspace = defineAuthorWorkspace({
  id: "inventory-author-hub",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "inventory",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "inventory-author-hub",
    title: "Inventory",
    context: `${context.snapshot.items.length} item${context.snapshot.items.length === 1 ? "" : "s"} · ${(context.snapshot.bodyBackgrounds ?? []).length} body type${(context.snapshot.bodyBackgrounds ?? []).length === 1 ? "" : "s"}`,
    blocks: [
      {
        type: "section",
        id: "inventory-author-items",
        label: "Items",
        importance: "primary",
        children: [{
          type: "custom",
          id: "inventory-author-item-list",
          role: "results",
          content: <div className="inventory-author-resource-list">
            <button type="button" onClick={() => context.pushTask(inventoryRoute("item"))}>[+ ITEM]</button>
            {context.snapshot.items.map((item) => <button
              type="button"
              className="inventory-author-resource-open"
              key={item.id}
              onClick={() => context.pushTask(inventoryRoute("item", item.id))}
            >
              <span>{item.name || item.key || "Untitled item"}</span>
              <small>start {item.startingQuantity ?? 0}{item.equipmentPlacements?.length ? ` · ${item.equipmentPlacements.length} placement${item.equipmentPlacements.length === 1 ? "" : "s"}` : ""}</small>
            </button>)}
            {!context.snapshot.items.length ? <small>No item definitions yet.</small> : null}
          </div>,
        }],
      },
      {
        type: "section",
        id: "inventory-author-body-types",
        label: "Body types",
        children: [{
          type: "custom",
          id: "inventory-author-body-list",
          role: "results",
          content: <div className="inventory-author-resource-list">
            <button type="button" onClick={() => context.pushTask(inventoryRoute("body-type"))}>[+ BODY TYPE]</button>
            {(context.snapshot.bodyBackgrounds ?? []).map((rawBodyType) => {
              const bodyType = normalizeBodyTypeDefinition(rawBodyType);
              return <button
                type="button"
                className="inventory-author-resource-open"
                key={bodyType.id}
                onClick={() => context.pushTask(inventoryRoute("body-type", bodyType.id))}
              >
                <span>{bodyType.name || "Untitled body type"}</span>
                <small>{bodyType.id === context.snapshot.startingBodyBackgroundId ? "starting · " : ""}{bodyType.slots.length} slot{bodyType.slots.length === 1 ? "" : "s"}</small>
              </button>;
            })}
            {!(context.snapshot.bodyBackgrounds ?? []).length ? <small>No body types yet.</small> : null}
          </div>,
        }],
      },
    ],
  }),
});
