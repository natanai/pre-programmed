import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { StructureNavigator } from "./StructureNavigator";

export const structureWorkspace = defineAuthorWorkspace({
  id: "narrative-structure",
  matches: (route) => route.type === "feature" && route.feature === "narrative" && route.workspace === "structure",
  createDraft: () => ({}),
  buildSpec: ({ context }) => {
    const current = context.snapshot.nodes.find((node) => node.id === context.playState.currentNodeId);
    return {
      id: "narrative-structure",
      title: "Story structure",
      context: current ? `Current · #${current.nodeNumber}` : undefined,
      blocks: [{
        type: "custom",
        id: "narrative-structure-browser",
        role: "specialized-control",
        content: <StructureNavigator
          embedded
          snapshot={context.snapshot}
          playState={context.playState}
          onOpenNode={(nodeId) => context.pushTask({
            type: "feature",
            feature: "narrative",
            workspace: "node",
            data: { nodeId },
          })}
          onEditInteraction={(interaction) => context.pushTask({
            type: "feature",
            feature: "narrative",
            workspace: "interaction",
            data: { interactionId: interaction.id },
          })}
        />,
      }],
    };
  },
});
