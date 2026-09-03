import type { PlayerWorkspaceContribution } from "../../player/workspaces/types";
import { Inventory } from "./ui/Inventory";

export const inventoryPlayerWorkspaceContribution: PlayerWorkspaceContribution = {
  feature: "inventory",
  workspace: "inventory",
  label: "Inventory",
  navigation: () => [{
    id: "inventory",
    label: "Inventory",
    request: { feature: "inventory", workspace: "inventory" },
  }],
  render: (_request, context) => <Inventory
    snapshot={context.snapshot}
    state={context.playState}
    onState={context.updateState}
    onOutput={context.output}
    onEvents={context.events}
  />,
};
