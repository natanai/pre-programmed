import { useMemo } from "react";
import { authoredSource, type AuthoredSourceIdentity } from "../../../engine/presentation/authoredSource";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import { interactionOutcomeProse } from "../interactionProse";
import { interpolateText } from "../interpolation";
import type { GameNode, Interaction, InteractionOutcome, TextPerformance } from "../model";
import { resolveActiveNodeConversationContext, resolveNodeConversationContext } from "../sceneContext";
import { compileTextNotation } from "../textNotation";

export const DEFAULT_NARRATIVE_TEXT_PERFORMANCE: TextPerformance = {
  charactersPerSecond: 18,
  cues: [],
};

export type NarrativeResolvedText = {
  text: string;
  performance: TextPerformance;
  speakerId: string | null;
  source: AuthoredSourceIdentity;
};

export type NarrativeContinuation = {
  node: GameNode | null;
  nodeDialoguePending: boolean;
  nodeDialogue: NarrativeResolvedText | null;
  interaction: Interaction | null;
  outcome: InteractionOutcome | null;
  interactionDialoguePending: boolean;
  interactionDialogue: NarrativeResolvedText | null;
  secondaryProsePending: boolean;
};

export function resolveNodeOpeningPresentation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  node: GameNode,
): NarrativeResolvedText {
  const narration = interpolateText(node.text, { snapshot, state });
  const dialogue = interpolateText(node.dialogueText ?? "", { snapshot, state });
  const beginsWithDialogue = !narration && Boolean(dialogue);
  const rawText = beginsWithDialogue ? dialogue : narration;
  const performance = beginsWithDialogue
    ? node.dialoguePerformance ?? DEFAULT_NARRATIVE_TEXT_PERFORMANCE
    : node.performance;
  const compiled = compileTextNotation(rawText, performance);
  const conversation = beginsWithDialogue ? resolveActiveNodeConversationContext(snapshot, state) : null;
  return {
    text: compiled.text,
    performance: compiled.performance,
    speakerId: conversation?.characterId ?? null,
    source: authoredSource("node", node.id, { section: beginsWithDialogue ? "dialogue" : "narration" }),
  };
}

function resolveNodeDialoguePresentation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  node: GameNode,
): NarrativeResolvedText | null {
  const dialogue = interpolateText(node.dialogueText ?? "", { snapshot, state });
  if (!dialogue) return null;
  const compiled = compileTextNotation(
    dialogue,
    node.dialoguePerformance ?? DEFAULT_NARRATIVE_TEXT_PERFORMANCE,
  );
  const conversation = resolveActiveNodeConversationContext(snapshot, state);
  return {
    text: compiled.text,
    performance: compiled.performance,
    speakerId: conversation?.characterId ?? null,
    source: authoredSource("node", node.id, { section: "dialogue" }),
  };
}

function resolveInteractionDialoguePresentation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  interaction: Interaction,
  outcome: InteractionOutcome,
): NarrativeResolvedText | null {
  const prose = interactionOutcomeProse(outcome);
  const dialogue = interpolateText(prose.dialogueText, { snapshot, state });
  if (!dialogue) return null;
  const compiled = compileTextNotation(dialogue, prose.dialoguePerformance);
  const conversation = resolveNodeConversationContext(snapshot, state, interaction.sourceNodeId);
  return {
    text: compiled.text,
    performance: compiled.performance,
    speakerId: conversation?.characterId ?? outcome.speakerId ?? null,
    source: authoredSource("interaction", interaction.id, {
      outcomeId: outcome.id,
      section: "dialogue",
    }),
  };
}

/**
 * Resolve follow-up authored prose from the currently displayed source.
 *
 * `*Pending` intentionally follows the authored/raw dialogue checks used by the
 * legacy App orchestration. The compiled presentation may still be null when
 * interpolation resolves that authored dialogue to an empty string; preserving
 * that distinction keeps this extraction behavior-neutral.
 */
export function resolveNarrativeContinuation(
  snapshot: ProjectSnapshot | null,
  state: PlayState | null,
  activeNodeId: string | undefined,
  activeSource: AuthoredSourceIdentity | undefined,
): NarrativeContinuation {
  const empty: NarrativeContinuation = {
    node: null,
    nodeDialoguePending: false,
    nodeDialogue: null,
    interaction: null,
    outcome: null,
    interactionDialoguePending: false,
    interactionDialogue: null,
    secondaryProsePending: false,
  };
  if (!snapshot || !state) return empty;

  const node = activeNodeId
    ? snapshot.nodes.find((candidate) => candidate.id === activeNodeId) ?? null
    : null;
  const nodeDialoguePending = Boolean(
    node
    && activeSource?.resourceKind === "node"
    && activeSource.resourceId === node.id
    && activeSource.focus?.section === "narration"
    && node.dialogueText?.trim(),
  );
  const nodeDialogue = nodeDialoguePending && node
    ? resolveNodeDialoguePresentation(snapshot, state, node)
    : null;

  const interaction = activeSource?.resourceKind === "interaction"
    ? snapshot.interactions.find((candidate) => candidate.id === activeSource.resourceId) ?? null
    : null;
  const outcome = interaction && activeSource?.focus?.outcomeId
    ? interaction.outcomes.find((candidate) => candidate.id === activeSource.focus?.outcomeId) ?? null
    : null;
  const interactionProse = outcome ? interactionOutcomeProse(outcome) : null;
  const interactionDialoguePending = Boolean(
    outcome
    && activeSource?.focus?.section === "narration"
    && interactionProse?.dialogueText.trim(),
  );
  const interactionDialogue = interactionDialoguePending && interaction && outcome
    ? resolveInteractionDialoguePresentation(snapshot, state, interaction, outcome)
    : null;

  return {
    node,
    nodeDialoguePending,
    nodeDialogue,
    interaction,
    outcome,
    interactionDialoguePending,
    interactionDialogue,
    secondaryProsePending: nodeDialoguePending || interactionDialoguePending,
  };
}

/** Keep continuation payload identities stable until their authored inputs change. */
export function useNarrativeContinuation(
  snapshot: ProjectSnapshot | null,
  state: PlayState | null,
  activeNodeId: string | undefined,
  activeSource: AuthoredSourceIdentity | undefined,
) {
  return useMemo(
    () => resolveNarrativeContinuation(snapshot, state, activeNodeId, activeSource),
    [activeNodeId, activeSource, snapshot, state],
  );
}
