import { useMemo } from "react";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import { resolveActiveNodeAnchor } from "../anchor";
import { isInteractionChoiceVisible } from "../choiceVisibility";
import { buildGraphIndex, notationForNode } from "../graph";
import type { GameNode, Interaction } from "../model";

export type NarrativePlayerChoice = {
  id: string;
  text: string;
  /** Project-authored copy for the expanded suggestion menu's info affordance. */
  menuHelpText?: string | null;
};

export type NarrativePlayerSurface = {
  currentNode: GameNode | null;
  anchor: ReturnType<typeof resolveActiveNodeAnchor>;
  currentNotation: string[];
  fallbackInput?: Interaction;
  fallbackNotation: string;
  immediateChoices: NarrativePlayerChoice[];
  promptChoices: NarrativePlayerChoice[];
};

function playerChoice(interaction: Interaction, menuHelpText: string | null = null): NarrativePlayerChoice {
  return {
    id: interaction.id,
    text: interaction.aliases[0] || interaction.wording,
    menuHelpText,
  };
}

function notationForInput(
  snapshot: ProjectSnapshot,
  state: PlayState,
  graph: ReturnType<typeof buildGraphIndex>,
  interaction: Interaction,
) {
  if (interaction.outcomes.some((outcome) => (outcome.authorStatus ?? "configured") === "draft")) return "[D]";
  const first = [...interaction.outcomes].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))[0];
  if (!first) return "[D]";
  if (first.disposition === "stay" || !first.destination) return "[H]";
  return notationForNode(snapshot, graph, state.currentNodeId, state.traversal, first.destination.nodeId).join("") || "[A1]";
}

/**
 * Narrative-owned derivation for the live terminal surface.
 *
 * The application shell consumes the result but does not need to understand
 * Narrative graph notation, choice visibility, fallback matching, or anchors.
 * This hook owns no mutations, navigation, persistence, or presentation state.
 */
export function useNarrativePlayerSurface(
  snapshot: ProjectSnapshot | null,
  state: PlayState | null,
): NarrativePlayerSurface {
  const graph = useMemo(() => snapshot ? buildGraphIndex(snapshot) : null, [snapshot]);

  return useMemo(() => {
    if (!snapshot || !state || !graph) return {
      currentNode: null,
      anchor: null,
      currentNotation: [],
      fallbackNotation: "[+ INVALID]",
      immediateChoices: [],
      promptChoices: [],
    };

    const currentNode = snapshot.nodes.find((node) => node.id === state.currentNodeId) ?? null;
    const currentInputs = snapshot.interactions.filter((interaction) =>
      interaction.sourceNodeId === state.currentNodeId && (interaction.matchMode ?? "command") === "command",
    );
    const fallbackInput = snapshot.interactions.find((interaction) =>
      interaction.sourceNodeId === state.currentNodeId && interaction.matchMode === "fallback",
    );
    const visibleInputs = currentInputs.filter((interaction) => isInteractionChoiceVisible(snapshot, state, interaction));
    const immediateChoices = visibleInputs
      .filter((interaction) => interaction.choiceVisibility === "immediate")
      .map((interaction) => playerChoice(interaction))
      .filter((choice) => choice.text);
    const promptChoices = visibleInputs
      .filter((interaction) => (interaction.choiceVisibility ?? "prompt") === "prompt")
      .map((interaction) => playerChoice(interaction, snapshot.settings.suggestionMenuHelpText))
      .filter((choice) => choice.text);

    return {
      currentNode,
      anchor: resolveActiveNodeAnchor(snapshot, state),
      currentNotation: notationForNode(snapshot, graph, state.currentNodeId, state.traversal, state.currentNodeId),
      fallbackInput,
      fallbackNotation: fallbackInput ? notationForInput(snapshot, state, graph, fallbackInput) : "[+ INVALID]",
      immediateChoices,
      promptChoices,
    };
  }, [graph, snapshot, state]);
}
