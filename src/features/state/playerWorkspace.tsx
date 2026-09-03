import type { PlayerWorkspaceContribution } from "../../player/workspaces/types";
import { visibleStateGroups } from "./playerPresentation";
import { StateStatus } from "./ui/StateStatus";

export const stateStatusPlayerWorkspaceContribution: PlayerWorkspaceContribution = {
  feature: "state",
  workspace: "status",
  label: "Status",
  navigation: (context) => visibleStateGroups(context.snapshot, context.playState, Date.now()).map(({ group }) => ({
    id: `state-group:${group.id}`,
    label: group.label,
    request: { feature: "state", workspace: "status", data: { groupId: group.id } },
  })),
  render: (request, context) => <StateStatus
    key={request.data?.groupId ?? "groups"}
    snapshot={context.snapshot}
    state={context.playState}
    initialGroupId={request.data?.groupId}
    onState={context.updateState}
    onOutput={context.output}
    onEvents={context.events}
  />,
};
