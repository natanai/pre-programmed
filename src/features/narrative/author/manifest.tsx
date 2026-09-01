import type { AuthorFeatureManifest } from "../../../author/features/types";
import { buildGraphIndex } from "../../../game/graph";
import { createDraftInteraction } from "../drafts";
import { AuthorInputSurface } from "./AuthorInputSurface";
import { InteractionEditor } from "./InteractionEditor";
import { NodeEditor } from "./NodeEditor";
import { notationForNarrativeInteraction } from "./notation";
import { StructureNavigator } from "./StructureNavigator";
import { narrativeAuthorTools } from "./tools";

const STRUCTURE_ROUTE = { type: "feature", feature: "narrative", workspace: "structure" } as const;

export const narrativeAuthorFeature: AuthorFeatureManifest = {
  id: "narrative",
  tools: narrativeAuthorTools,
  resources: [
    {
      kind: "node",
      label: "Node",
      pluralLabel: "Nodes",
      list: (snapshot) => snapshot.nodes.map((node) => ({
        id: node.id,
        value: node.id,
        label: `Node #${node.nodeNumber}`,
        detail: node.text.trim().slice(0, 80),
      })),
      editRoute: (resource) => ({
        type: "feature",
        feature: "narrative",
        workspace: "node",
        data: { nodeId: resource.id },
      }),
    },
  ],
  terminalShortcuts: [
    { commands: ["/structure", "structure"], route: STRUCTURE_ROUTE },
  ],
  buildUnhandledInputMutation(sourceNodeId, input) {
    const interaction = createDraftInteraction(sourceNodeId, input.trim());
    return {
      operations: [{ type: "interaction.upsert", interaction }],
      description: `Created draft user input ${interaction.wording}`,
    };
  },
  renderPlaySurface(context) {
    const currentInputs = context.snapshot.interactions.filter((interaction) =>
      interaction.sourceNodeId === context.playState.currentNodeId
      && (interaction.matchMode ?? "command") === "command");
    if (!currentInputs.length) return null;
    const graph = buildGraphIndex(context.snapshot);
    return <AuthorInputSurface
      choices={currentInputs}
      onChoose={(interaction) => {
        const input = interaction.aliases[0] || interaction.wording;
        if (input) context.submitInput(input);
      }}
      notationForChoice={(interaction) => notationForNarrativeInteraction(
        context.snapshot,
        context.playState,
        interaction,
        graph,
      )}
      onEdit={(interaction) => context.pushTask({
        type: "feature",
        feature: "narrative",
        workspace: "interaction",
        data: { interactionId: interaction.id },
      })}
    />;
  },
  renderWorkspace(route, context) {
    if (route.type === "feature" && route.feature === "narrative" && route.workspace === "interaction") {
      const initial = route.data?.interactionId
        ? context.snapshot.interactions.find((candidate) => candidate.id === route.data?.interactionId)
        : undefined;
      const fallback = route.data?.fallback === "true";
      return <div className="dialogue-authoring-popover">
        <InteractionEditor
          snapshot={context.snapshot}
          playState={context.playState}
          initial={initial}
          initialCommand={route.data?.command ?? ""}
          fallback={fallback}
          onSave={async (operations, description) => {
            const result = await context.persist(operations, description);
            if (result.status === "saved" || result.status === "queued") context.completeTask({ type: "saved" });
            return result;
          }}
          onCancel={context.leaveCurrentTask}
          onDirtyChange={context.setWorkspaceDirty}
        />
      </div>;
    }

    if (route.type === "feature" && route.feature === "narrative" && route.workspace === "node") {
      const node = route.data?.nodeId
        ? context.snapshot.nodes.find((candidate) => candidate.id === route.data?.nodeId)
        : undefined;
      if (!node) return null;
      return <NodeEditor
        node={node}
        snapshot={context.snapshot}
        onSave={context.persist}
        onCancel={context.leaveCurrentTask}
        onDirtyChange={context.setWorkspaceDirty}
      />;
    }

    if (route.type === "feature" && route.feature === "narrative" && route.workspace === "structure") return <StructureNavigator
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
      onClose={context.leaveCurrentTask}
    />;

    return null;
  },
};
