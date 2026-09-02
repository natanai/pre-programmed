import type { AuthorFeatureManifest } from "../../../author/features/types";
import { previewEventsForEffects } from "../../../author/rules/catalog";
import { normalizePlayerInput } from "../../../engine/input/normalize";
import { buildGraphIndex } from "../graph";
import { createDraftInteraction } from "../drafts";
import { AuthorInputSurface } from "./AuthorInputSurface";
import { InteractionEditor } from "./InteractionEditor";
import { nodeWorkspace } from "./nodeWorkspace";
import { notationForNarrativeInteraction } from "./notation";
import { StructureNavigator } from "./StructureNavigator";
import { narrativeAuthorSearch, narrativeAuthorTools } from "./tools";
import { interactionVisibilityEffectAdapter, transitionEffectAdapter, visitedConditionAdapter } from "./ruleAdapters";
import { narrativeProjectReferences } from "./references";

const STRUCTURE_ROUTE = { type: "feature", feature: "narrative", workspace: "structure" } as const;

export const narrativeAuthorFeature: AuthorFeatureManifest = {
  id: "narrative",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "narrative") return null;
    if (route.workspace === "structure") return "Story structure";
    if (route.workspace === "node") {
      const node = snapshot.nodes.find((candidate) => candidate.id === route.data?.nodeId);
      return node ? `Node #${node.nodeNumber}` : "New node";
    }
    if (route.workspace === "interaction") {
      const interaction = snapshot.interactions.find((candidate) => candidate.id === route.data?.interactionId);
      if (route.data?.fallback === "true" || interaction?.matchMode === "fallback") return "Invalid input response";
      return interaction?.wording || interaction?.aliases[0] || route.data?.command || "New scene input";
    }
    return null;
  },
  conditions: [visitedConditionAdapter],
  effects: [interactionVisibilityEffectAdapter, transitionEffectAdapter],
  references: [narrativeProjectReferences],
  tools: narrativeAuthorTools,
  search: narrativeAuthorSearch,
  workspaces: [nodeWorkspace],
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
  capabilities: [{
    id: "input.capture-unmatched",
    resolve(request, { snapshot }) {
      const sourceNodeId = typeof request.data?.sourceNodeId === "string" ? request.data.sourceNodeId : "";
      const input = typeof request.data?.input === "string" ? request.data.input.trim() : "";
      if (!sourceNodeId || !input) return null;
      const normalized = normalizePlayerInput(input);
      const existing = snapshot.interactions.find((interaction) =>
        interaction.sourceNodeId === sourceNodeId
        && (interaction.matchMode ?? "command") === "command"
        && interaction.aliases.some((alias) => normalizePlayerInput(alias) === normalized));
      if (existing) return {
        type: "handled",
        message: `DRAFT ALREADY EXISTS: ${existing.wording || existing.aliases[0]}`,
        value: existing.id,
      };
      const interaction = createDraftInteraction(sourceNodeId, input);
      return {
        type: "mutation",
        operations: [{ type: "interaction.upsert", interaction }],
        description: `Created draft user input ${interaction.wording}`,
        message: `DRAFT INPUT CREATED: ${interaction.wording}`,
      };
    },
  }],
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
          onRegisterSave={context.registerWorkspaceSave}
          onPreview={(outcome) => context.runtime.preview({
            text: outcome.responseText,
            performance: outcome.responsePerformance,
            speakerId: outcome.speakerId,
            events: previewEventsForEffects(outcome.effects, context.snapshot),
          })}
          onSave={async (operations, description) => {
            const result = await context.persist(operations, description);
            if (result.status !== "saved" && result.status !== "queued") return result;
            if (resourceTask) {
              const operation = operations.find((candidate) => candidate.type === "interaction.upsert");
              if (operation?.type === "interaction.upsert") context.completeTask({
                type: "resource",
                kind: "interaction",
                id: operation.interaction.id,
                value: operation.interaction.id,
                label: operation.interaction.wording || operation.interaction.aliases[0] || "Invalid input response",
              });
            }
            return result;
          }}
          onCancel={context.hasParentTask ? context.leaveCurrentTask : undefined}
          onDirtyChange={context.setWorkspaceDirty}
        />
      </div>;
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
