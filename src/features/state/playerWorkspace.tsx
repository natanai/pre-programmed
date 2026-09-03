import type { PlayerWorkspaceContribution } from "../../player/workspaces/types";
import { StateStatus } from "./ui/StateStatus";

export const stateStatusPlayerWorkspaceContribution: PlayerWorkspaceContribution = {
  feature: "state",
  workspace: "status",
  label: "Status",
  render: (_request, context) => <StateStatus
    snapshot={context.snapshot}
    state={context.playState}
    onState={context.updateState}
    onOutput={context.output}
    onEvents={context.events}
  />,
};
