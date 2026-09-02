import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { Equipment } from "../ui/Equipment";

export const equipmentPlayerWorkspace = defineAuthorWorkspace({
  id: "equipment-player",
  matches: (route) => route.type === "feature" && route.feature === "equipment" && route.workspace === "equipment",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "equipment-player",
    title: "Equipment",
    context: context.snapshot.bodyTypes.find((body) => body.id === context.playState.activeBodyTypeId)?.name || "Body",
    blocks: [{ type: "custom", id: "equipment-player-view", role: "specialized-control", content: <Equipment snapshot={context.snapshot} state={context.playState} /> }],
  }),
});
