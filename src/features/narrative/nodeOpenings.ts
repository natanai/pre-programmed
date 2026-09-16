import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { selectConditionalCandidate } from "../../engine/rules/conditionalSelection";
import { ALWAYS } from "../../engine/rules/model";
import { makeId } from "../../engine/project/id";
import type { GameNode, NodeOpening, TextPerformance } from "./model";

export const DEFAULT_NODE_TEXT_PERFORMANCE: TextPerformance = { charactersPerSecond: 18, cues: [] };

export function createNodeOpening(order = 0): NodeOpening {
  return {
    id: makeId(),
    order,
    condition: ALWAYS,
    narrationText: "",
    dialogueText: "",
    narrationPerformance: { ...DEFAULT_NODE_TEXT_PERFORMANCE, cues: [] },
    dialoguePerformance: { ...DEFAULT_NODE_TEXT_PERFORMANCE, cues: [] },
  };
}

export function orderedNodeOpenings(node: Pick<GameNode, "openings">) {
  return [...node.openings].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

/** Deterministic author/search fallback only; runtime AUTO selection uses conditions. */
export function defaultNodeOpening(node: Pick<GameNode, "openings">) {
  return orderedNodeOpenings(node)[0] ?? null;
}

export function nodeOpeningText(opening: Pick<NodeOpening, "narrationText" | "dialogueText">) {
  return opening.narrationText || opening.dialogueText || "";
}

export function nodeEntryCount(state: Pick<PlayState, "traversal">, nodeId: string) {
  return state.traversal.reduce((count, traversedNodeId) => count + Number(traversedNodeId === nodeId), 0);
}

export function nodeOpeningSnippet(opening: NodeOpening, maxLength = 90) {
  const text = nodeOpeningText(opening).trim().replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** One canonical private Author title. Player prose never participates in Node identity. */
export function nodeAuthorTitle(node: GameNode) {
  const label = node.authorLabel.trim();
  return `Node #${node.nodeNumber}${label ? ` · ${label}` : ""}`;
}

/** Shared display-label contract for existing Author consumers. */
export const nodeAuthorLabel = nodeAuthorTitle;

/**
 * Resolve exactly one Node-owned opening for the current entry.
 * A specific opening id is an explicit author override and therefore bypasses
 * that opening's normal selection condition. AUTO evaluates ordered conditions.
 */
export function resolveNodeOpening(
  snapshot: ProjectSnapshot,
  state: PlayState,
  node: GameNode,
  openingId: string | null = state.currentNodeOpeningId,
): NodeOpening | null {
  if (openingId) return node.openings.find((opening) => opening.id === openingId) ?? null;
  return selectConditionalCandidate(node.openings, {
    snapshot,
    state,
    occurrence: nodeEntryCount(state, node.id),
    scope: { kind: "node", id: node.id },
  });
}
