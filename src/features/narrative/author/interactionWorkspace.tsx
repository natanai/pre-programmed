import type { Dispatch, SetStateAction } from "react";
import { previewEventsForEffects } from "../../../author/rules/catalog";
import type { AuthorUiAction, AuthorUiNode } from "../../../author/ui/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { Interaction } from "../model";
import {
  InteractionComposer,
  type InteractionEditorScreen,
} from "./InteractionEditor";
import {
  interactionAuthorLabel,
  interactionSaveDescription,
  normalizeInteractionAuthorDraft,
  prepareInteractionForSave,
} from "./interactionAuthoring";

type InteractionWorkspaceDraft = {
  interaction: Interaction;
  fallbackMode: boolean;
  initiallyNew: boolean;
  screen: InteractionEditorScreen;
  newOutcomeIds: Set<string>;
  error: string;
  saving: boolean;
  confirmDelete: boolean;
};

function interactionSignature(draft: InteractionWorkspaceDraft) {
  return JSON.stringify(draft.interaction);
}

function interactionDeleteDescription(interaction: Interaction, fallbackMode: boolean) {
  if (fallbackMode) return "Deleted invalid-input response";
  if (interaction.matchMode === "capture") return "Deleted player-input capture";
  return `Deleted user input ${interaction.wording || interaction.aliases[0]}`;
}

export const interactionWorkspace = defineAuthorWorkspace<InteractionWorkspaceDraft>({
  id: "narrative.interaction",
  matches(route) {
    return route.type === "feature"
      && route.feature === "narrative"
      && route.workspace === "interaction";
  },
  createDraft(route, context) {
    const initial = route.data?.interactionId
      ? context.snapshot.interactions.find((candidate) => candidate.id === route.data?.interactionId)
      : undefined;
    const fallbackMode = route.data?.fallback === "true" || initial?.matchMode === "fallback";
    const sourceNodeId = initial?.sourceNodeId
      ?? route.data?.sourceNodeId
      ?? context.playState.currentNodeId;
    const interaction = normalizeInteractionAuthorDraft(
      initial,
      sourceNodeId,
      route.data?.command ?? "",
      fallbackMode,
    );
    const requestedOutcomeId = route.data?.outcomeId;
    const screen: InteractionEditorScreen = requestedOutcomeId
      && interaction.outcomes.some((outcome) => outcome.id === requestedOutcomeId)
      ? { type: "response", outcomeId: requestedOutcomeId }
      : { type: "overview" };
    return {
      interaction,
      fallbackMode,
      initiallyNew: !initial,
      screen,
      newOutcomeIds: new Set(),
      error: "",
      saving: false,
      confirmDelete: false,
    };
  },
  signature: interactionSignature,
  canSave: ({ draft }) => !draft.saving,
  save: async ({ route, context, draft, setDraft }) => {
    const prepared = prepareInteractionForSave(draft.interaction, draft.fallbackMode, context.snapshot);
    if ("issue" in prepared) {
      setDraft((current) => ({
        ...current,
        saving: false,
        error: prepared.issue.message,
        screen: prepared.issue.outcomeId
          ? { type: "response", outcomeId: prepared.issue.outcomeId }
          : { type: "overview" },
      }));
      return { accepted: false };
    }

    const existedBeforeSave = context.snapshot.interactions.some((candidate) => candidate.id === prepared.interaction.id);
    setDraft((current) => ({ ...current, saving: true, error: "" }));
    const result = await context.persist(
      [{ type: "interaction.upsert", interaction: prepared.interaction }],
      interactionSaveDescription(
        prepared.interaction,
        existedBeforeSave,
        draft.fallbackMode,
        context.snapshot,
      ),
    );
    if (result.status !== "saved" && result.status !== "queued") {
      setDraft((current) => ({
        ...current,
        saving: false,
        error: result.status === "conflict"
          ? "The project changed while this interaction was saving. Your draft is still here; save it again."
          : result.message ?? "This interaction could not be saved. Your draft is still here.",
      }));
      return { accepted: false };
    }

    const savedDraft: InteractionWorkspaceDraft = {
      ...draft,
      interaction: prepared.interaction,
      initiallyNew: false,
      newOutcomeIds: new Set(),
      error: "",
      saving: false,
      confirmDelete: false,
    };
    return {
      accepted: true,
      draft: savedDraft,
      ...(route.data?.resourceTask === "interaction" ? {
        completion: {
          type: "resource" as const,
          kind: "interaction",
          id: prepared.interaction.id,
          value: prepared.interaction.id,
          label: interactionAuthorLabel(prepared.interaction),
        },
      } : {}),
    };
  },
  buildSpec({ context, draft, setDraft }) {
    const interaction = draft.interaction;
    const persisted = context.snapshot.interactions.some((candidate) => candidate.id === interaction.id);
    const sourceNode = context.snapshot.nodes.find((node) => node.id === interaction.sourceNodeId);

    const setInteraction: Dispatch<SetStateAction<Interaction>> = (next) => {
      setDraft((current) => ({
        ...current,
        interaction: typeof next === "function" ? next(current.interaction) : next,
        error: "",
        confirmDelete: false,
      }));
    };
    const setScreen: Dispatch<SetStateAction<InteractionEditorScreen>> = (next) => {
      setDraft((current) => ({
        ...current,
        screen: typeof next === "function" ? next(current.screen) : next,
        error: "",
      }));
    };
    const setNewOutcomeIds: Dispatch<SetStateAction<Set<string>>> = (next) => {
      setDraft((current) => ({
        ...current,
        newOutcomeIds: typeof next === "function" ? next(current.newOutcomeIds) : next,
      }));
    };

    const remove = async () => {
      if (!persisted || draft.saving) return;
      setDraft((current) => ({ ...current, saving: true, error: "" }));
      const result = await context.persist(
        [{ type: "interaction.delete", id: interaction.id }],
        interactionDeleteDescription(interaction, draft.fallbackMode),
      );
      if (result.status === "saved" || result.status === "queued") {
        context.leaveCurrentTask();
        return;
      }
      setDraft((current) => ({
        ...current,
        saving: false,
        confirmDelete: false,
        error: result.status === "conflict"
          ? "The project changed while this interaction was being deleted. Nothing was removed."
          : result.message ?? "This interaction could not be deleted.",
      }));
    };

    const blocks: AuthorUiNode[] = [{
      type: "custom",
      id: "interaction-composer",
      role: "specialized-control",
      content: <InteractionComposer
        snapshot={context.snapshot}
        playState={context.playState}
        draft={interaction}
        setDraft={setInteraction}
        fallbackMode={draft.fallbackMode}
        isNew={draft.initiallyNew}
        screen={draft.screen}
        setScreen={setScreen}
        newOutcomeIds={draft.newOutcomeIds}
        setNewOutcomeIds={setNewOutcomeIds}
        error={draft.error}
        onClearError={() => setDraft((current) => ({ ...current, error: "" }))}
        onPreview={(value, speakerId, outcome) => context.runtime.preview({
          text: value.text,
          performance: value.performance,
          speakerId,
          events: previewEventsForEffects(outcome.effects, context.snapshot),
        })}
        onCreateDestination={(onCreated) => context.resources.create("node", (resource) => onCreated(resource.id))}
        onEditDestination={(nodeId) => context.resources.edit("node", nodeId)}
      />,
    }];

    if (draft.confirmDelete) blocks.push({
      type: "status",
      id: "interaction-delete-confirmation",
      tone: "error",
      text: `DELETE ${draft.fallbackMode ? "INVALID-INPUT RESPONSE" : interaction.matchMode === "capture" ? "PLAYER-INPUT CAPTURE" : "USER INPUT"}?`,
    });

    const actions: AuthorUiAction[] = [];
    if (persisted && draft.screen.type === "overview") {
      if (draft.confirmDelete) {
        actions.push(
          {
            id: "interaction-confirm-delete",
            label: "CONFIRM DELETE",
            tone: "danger",
            disabled: draft.saving,
            onAction: () => { void remove(); },
          },
          {
            id: "interaction-keep",
            label: "KEEP",
            disabled: draft.saving,
            onAction: () => setDraft((current) => ({ ...current, confirmDelete: false })),
          },
        );
      } else {
        actions.push({
          id: "interaction-delete",
          label: "DELETE INPUT",
          tone: "danger",
          disabled: draft.saving,
          onAction: () => setDraft((current) => ({ ...current, confirmDelete: true })),
        });
      }
    }

    return {
      id: "narrative.interaction",
      title: interactionAuthorLabel(interaction),
      context: sourceNode ? `Node #${sourceNode.nodeNumber}` : "Unknown source node",
      blocks,
      actions,
    };
  },
});
