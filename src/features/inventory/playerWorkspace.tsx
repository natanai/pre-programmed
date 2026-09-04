import type { PlayerWorkspaceContribution } from "../../player/workspaces/types";
import { Inventory } from "./ui/Inventory";
import "./ui/inventoryLiveAuthoring.css";

export const inventoryPlayerWorkspaceContribution: PlayerWorkspaceContribution = {
  feature: "inventory",
  workspace: "inventory",
  label: "Inventory",
  navigation: () => [{
    id: "inventory",
    label: "Inventory",
    request: { feature: "inventory", workspace: "inventory" },
  }],
  authorActions: (_request, context) => context.author ? [
    {
      id: "inventory-items",
      label: "ITEM DEFINITIONS",
      onAction: () => context.author?.openWorkspace("inventory", "items"),
    },
    {
      id: "inventory-body-types",
      label: "BODY TYPES",
      onAction: () => context.author?.openWorkspace("inventory", "body-types"),
    },
    {
      id: "inventory-new-item",
      label: "+ ITEM",
      onAction: () => context.author?.openWorkspace("inventory", "item"),
    },
  ] : [],
  render: (_request, context) => <Inventory
    snapshot={context.snapshot}
    state={context.playState}
    onState={context.updateState}
    onOutput={context.output}
    onEvents={context.events}
    onEditItem={context.author ? (itemId) => context.author?.editResource("item", itemId) : undefined}
    onEditBodyType={context.author ? (bodyTypeId) => context.author?.editResource("body-type", bodyTypeId) : undefined}
  />,
};
