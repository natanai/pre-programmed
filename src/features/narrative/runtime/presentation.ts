import { useMemo } from "react";
import { authoredSource, type AuthoredSourceIdentity } from "../../../engine/presentation/authoredSource";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import { interactionOutcomeProse } from "../interactionProse";
import { interpolateText } from "../interpolation";
import type { GameNode, Interaction, InteractionOutcome, NodeOpening, TextPerformance } from "../model";
import { DEFAULT_NODE_TEXT_PERFORMANCE, resolveNodeOpening } from "../nodeOpenings";
import { resolveActiveNodeConversationContext, resolveNodeConversationContext } from "../sceneContext";
import { compileTextNotation } from "../textNotation";

export const DEFAULT_NARRATIVE_TEXT_PERFORMANCE: TextPerformance = DEFAULT_NODE_TEXT_PERFORMANCE;

export type NarrativeResolvedText = {
  text: string;
  performance: TextPerformance;
  speakerId: string | null;
  source: AuthoredSourceIdentity;
};

export type NarrativeContinuation = {
  node: GameNode | null;
  nodeOpening: NodeOpening | null;
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
  authorMode = false,
): NarrativeResolvedText {
  const opening = resolveNodeOpening(snapshot, state, node);
  const narration = interpolateText(opening?.narrationText ?? "", { snapshot, state, authorMode });
  const dialogue = interpolateText(opening?.dialogueText ?? "", { snapshot, state, authorMode });
  const beginsWithDialogue = !narration && Boolean(dialogue);
  const rawText = beginsWithDialogue ? dialogue : narration;
  const performance = beginsWithDialogue
    ? opening?.dialoguePerformance ?? DEFAULT_NARRATIVE_TEXT_PERFORMANCE
    : opening?.narrationPerformance ?? DEFAULT_NARRATIVE_TEXT_PERFORMANCE;
  const compiled = compileTextNotation(rawText, performance);
  const conversation = beginsWithDialogue ? resolveActiveNodeConversationContext(snapshot, state) : null;
  return {
    text: compiled.text,
    performance: compiled.performance,
    speakerId: conversation?.characterId ?? null,
    source: authoredSource("node", node.id, {
      ...(opening ? { openingId: opening.id } : {}),
      section: beginsWithDialogue ? "dialogue" : "narration",
    }),
  };
}

function resolveNodeDialoguePresentation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  node: GameNode,
  opening: NodeOpening,
  authorMode: boolean,
): NarrativeResolvedText | null {
  const dialogue = interpolateText(opening.dialogueText, { snapshot, state, authorMode });
  if (!dialogue) return null;
  const compiled = compileTextNotation(dialogue, opening.dialoguePerformance);
  const conversation = resolveActiveNodeConversationContext(snapshot, state);
  return {
    text: compiled.text,
    performance: compiled.performance,
    speakerId: conversation?.characterId ?? null,
    source: authoredSource("node", node.id, { openingId: opening.id, section: "dialogue" }),
  };
}

function resolveInteractionDialoguePresentation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  interaction: Interaction,
  outcome: InteractionOutcome,
  authorMode: boolean,
): NarrativeResolvedText | null {
  const prose = interactionOutcomeProse(outcome);
  const dialogue = interpolateText(prose.dialogueText, { snapshot, state, authorMode });
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

/** Resolve follow-up authored prose from the currently displayed source. */
export function resolveNarrativeContinuation(
  snapshot: ProjectSnapshot | null,
  state: PlayState | null,
  activeNodeId: string | undefined,
  activeSource: AuthoredSourceIdentity | undefined,
  authorMode = false,
): NarrativeContinuation {
  const empty: NarrativeContinuation = {
    node: null,
    nodeOpening: null,
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
  const openingFromSource = node && activeSource?.resourceKind === "node" && activeSource.resourceId === node.id
    ? node.openings.find((candidate) => candidate.id === activeSource.focus?.openingId) ?? null
    : null;
  const nodeOpening = openingFromSource ?? (node ? resolveNodeOpening(snapshot, state, node) : null);
  const nodeDialoguePending = Boolean(
    node
    && nodeOpening
    && activeSource?.resourceKind === "node"
    && activeSource.resourceId === node.id
    && activeSource.focus?.section === "narration"
    && nodeOpening.dialogueText.trim(),
  );
  const nodeDialogue = nodeDialoguePending && node && nodeOpening
    ? resolveNodeDialoguePresentation(snapshot, state, node, nodeOpening, authorMode)
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
    ? resolveInteractionDialoguePresentation(snapshot, state, interaction, outcome, authorMode)
    : null;

  return {
    node,
    nodeOpening,
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
  authorMode = false,
) {
  return useMemo(
    () => resolveNarrativeContinuation(snapshot, state, activeNodeId, activeSource, authorMode),
    [activeNodeId, activeSource, authorMode, snapshot, state],
  );
}
