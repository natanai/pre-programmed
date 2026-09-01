import type { AuthorFeatureManifest } from "../../../author/features/types";
import { buildGraphIndex, notationForNode } from "../../../game/graph";
import type { Interaction } from "../../../game/model";
import { createDraftInteraction } from "../drafts";
import { AuthorInputSurface } from "./AuthorInputSurface";
import { InteractionEditor } from "./InteractionEditor";
import { NodeEditor } from "./NodeEditor";
import { StructureNavigator } from "./StructureNavigator";
import { narrativeAuthorTools } from "./tools";

export const narrativeAuthorFeature: AuthorFeatureManifest = {
  id: "narrative",
  tools: narrativeAuthorTools,
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
    const notationForChoice = (interaction: Interaction) => {
      if (interaction.outcomes.some((outcome) => (outcome.authorStatus ?? "configured") === "draft")) return "[D]";
      const first = [...interaction.outcomes].sort((left, right) => left.order - right.order)[0];
      if (!first) return "[D]";
      if (first.disposition === "stay" || !first.destinationNodeId) return "[H]";
      return notationForNode(
        context.snapshot,
        graph,
        context.playState.currentNodeId,
        context.playState.traversal,
        first.destinationNodeId,
      ).join("") || "[A1]";
    };
    return <AuthorInputSurface
      choices={currentInputs}
      onChoose={(interaction) => {
        const input = interaction.aliases[0] || interaction.wording;
        if (input) context.submitInput(input);
      }}
      notationForChoice={notationForChoice}
      onEdit={(interaction) => context.pushPanel({ type: "interaction", interaction })}
    />;
  },
  renderWorkspace(route, context) {
    if (route.type === "interaction") {
      return <div className="dialogue-authoring-popover">
        <InteractionEditor
          snapshot={context.snapshot}
          playState={context.playState}
          initial={route.interaction}
          initialCommand={route.command}
          fallback={route.fallback}
          onSave={(operations, description) => context.persist(operations, description, true)}
          onCancel={context.leaveCurrentSurface}
          onDirtyChange={context.setWorkspaceDirty}
        />
      </div>;
    }

    if (route.type === "node") return <NodeEditor
      node={route.node}
      snapshot={context.snapshot}
      onSave={context.persist}
      onCancel={context.leaveCurrentSurface}
      onDirtyChange={context.setWorkspaceDirty}
    />;

    if (route.type === "structure") return <StructureNavigator
      snapshot={context.snapshot}
      playState={context.playState}
      onOpenNode={(nodeId) => {
        const node = context.snapshot.nodes.find((candidate) => candidate.id === nodeId);
        if (node) context.pushPanel({ type: "node", node });
      }}
      onEditInteraction={(interaction) => context.pushPanel({ type: "interaction", interaction })}
      onClose={context.leaveCurrentSurface}
    />;

    return null;
  },
};
