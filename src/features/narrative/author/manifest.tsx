import type { AuthorFeatureManifest } from "../../../author/features/types";
import { buildGraphIndex } from "../../../game/graph";
import { makeId, nextNodeNumber } from "../../../game/model";
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
      createRoute: () => ({
        type: "feature",
        feature: "narrative",
        workspace: "node",
        data: { resourceTask: "node" },
      }),
      editRoute: (resource) => ({
        type: "feature",
        feature: "narrative",
        workspace: "node",
        data: { nodeId: resource.id, resourceTask: "node" },
      }),
    },
    {
      kind: "interaction",
      label: "Interaction",
      pluralLabel: "Interactions",
      list: (snapshot) => snapshot.interactions.map((interaction) => {
        const source = snapshot.nodes.find((node) => node.id === interaction.sourceNodeId);
        return {
          id: interaction.id,
          value: interaction.id,
          label: interaction.wording || interaction.aliases[0] || "Invalid input response",
          detail: source ? `Node #${source.nodeNumber}` : "Unknown source node",
        };
      }),
      createRoute: () => ({
        type: "feature",
        feature: "narrative",
        workspace: "interaction",
        data: { resourceTask: "interaction" },
      }),
      editRoute: (resource) => ({
        type: "feature",
        feature: "narrative",
        workspace: "interaction",
        data: { interactionId: resource.id, resourceTask: "interaction" },
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
      const resourceTask = route.data?.resourceTask === "interaction";
      return <div className="dialogue-authoring-popover">
        <InteractionEditor
          snapshot={context.snapshot}
          playState={context.playState}
          initial={initial}
          initialCommand={route.data?.command ?? ""}
          fallback={fallback}
          onSave={async (operations, description) => {
            const result = await context.persist(operations, description);
            if (result.status !== "saved" && result.status !== "queued") return result;
            if (resourceTask) {
              const operation = operations.find((candidate) => candidate.type === "interaction.upsert");
              if (operation?.type === "interaction.upsert") {
                context.completeTask({
                  type: "resource",
                  kind: "interaction",
                  id: operation.interaction.id,
                  value: operation.interaction.id,
                  label: operation.interaction.wording || operation.interaction.aliases[0] || "Invalid input response",
                });
                return result;
              }
            }
            context.completeTask({ type: "saved" });
            return result;
          }}
          onCancel={context.leaveCurrentTask}
          onDirtyChange={context.setWorkspaceDirty}
        />
      </div>;
    }

    if (route.type === "feature" && route.feature === "narrative" && route.workspace === "node") {
      const requestedNodeId = route.data?.nodeId;
      const resourceTask = route.data?.resourceTask === "node";
      const node = requestedNodeId
        ? context.snapshot.nodes.find((candidate) => candidate.id === requestedNodeId)
        : resourceTask ? {
          id: makeId(),
          nodeNumber: nextNodeNumber(context.snapshot),
          text: "",
          ending: false,
          tags: [],
          characterId: null,
          locationId: null,
          performance: { charactersPerSecond: 18, cues: [] },
        } : undefined;
      if (!node) return null;
      return <NodeEditor
        node={node}
        snapshot={context.snapshot}
        onSave={async (operations, description) => {
          const result = await context.persist(operations, description);
          if (resourceTask && (result.status === "saved" || result.status === "queued")) {
            const operation = operations.find((candidate) => candidate.type === "node.upsert");
            if (operation?.type === "node.upsert") context.completeTask({
              type: "resource",
              kind: "node",
              id: operation.node.id,
              value: operation.node.id,
              label: `Node #${operation.node.nodeNumber}`,
            });
          }
          return result;
        }}
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
