import type { PlayerWorkspaceContribution } from "../../player/workspaces/types";
import { visibleStateGroups } from "./playerPresentation";
import { StateStatus } from "./ui/StateStatus";

function stateResourceData(resourceKind: "variable" | "computed" | "state-group", resourceId?: string) {
  return {
    resourceKind,
    resourceTask: resourceKind,
    ...(resourceId ? { resourceId } : {}),
  };
}

export const stateStatusPlayerWorkspaceContribution: PlayerWorkspaceContribution = {
  feature: "state",
  workspace: "status",
  label: "Status",
  navigation: (context) => visibleStateGroups(context.snapshot, context.playState, Date.now()).map(({ group }) => ({
    id: `state-group:${group.id}`,
    label: group.label,
    request: { feature: "state", workspace: "status", data: { groupId: group.id } },
  })),
  authorActions: (request, context) => {
    if (!context.author) return [];
    const groupId = request.data?.groupId;
    return [
      ...(groupId ? [{
        id: "state-edit-group",
        label: "EDIT GROUP",
        onAction: () => context.author?.openWorkspace("state", "definitions", stateResourceData("state-group", groupId)),
      }] : [{
        id: "state-player-groups",
        label: "PLAYER GROUPS",
        onAction: () => context.author?.openWorkspace("state", "definitions"),
      }]),
      {
        id: "state-variables",
        label: "VARIABLES",
        onAction: () => context.author?.openWorkspace("state", "definitions"),
      },
      {
        id: "state-new-variable",
        label: "+ VARIABLE",
        onAction: () => context.author?.openWorkspace("state", "definitions", stateResourceData("variable")),
      },
      ...(!groupId ? [{
        id: "state-new-group",
        label: "+ GROUP",
        onAction: () => context.author?.openWorkspace("state", "definitions", stateResourceData("state-group")),
      }] : []),
    ];
  },
  render: (request, context) => <StateStatus
    key={request.data?.groupId ?? "groups"}
    snapshot={context.snapshot}
    state={context.playState}
    initialGroupId={request.data?.groupId}
    onState={context.updateState}
    onOutput={context.output}
    onEvents={context.events}
    onEditGroup={context.author ? (groupId) => context.author?.openWorkspace("state", "definitions", stateResourceData("state-group", groupId)) : undefined}
    onEditEntry={context.author ? (entry) => context.author?.openWorkspace(
      "state",
      "definitions",
      stateResourceData(entry.kind === "computed" ? "computed" : "variable", entry.definition.id),
    ) : undefined}
  />,
};
