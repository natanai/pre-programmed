import type { MutationOperation } from "../../engine/project/model";
import type { Condition } from "../../engine/rules/model";
import type { GameNode, Interaction, NodeOpening, TextPerformance } from "./model";
import type { NarrativeProjectSlice } from "./projectSlice";

const DEFAULT_TEXT_PERFORMANCE: TextPerformance = { charactersPerSecond: 18, cues: [] };
const ALWAYS: Condition = { type: "always" };

type NarrativeSnapshotLike = {
  nodes?: unknown;
  interactions?: unknown;
};

type HistoricalNode = Partial<GameNode> & {
  id?: unknown;
  nodeNumber?: unknown;
  text?: unknown;
  dialogueText?: unknown;
  performance?: unknown;
  dialoguePerformance?: unknown;
  characterId?: unknown;
  conversation?: { mode?: unknown; characterIds?: unknown };
};

type HistoricalOutcome = Record<string, unknown> & {
  destinationNodeId?: unknown;
  destination?: unknown;
};

function textPerformance(value: unknown): TextPerformance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_TEXT_PERFORMANCE, cues: [] };
  const candidate = value as Partial<TextPerformance>;
  return {
    charactersPerSecond: Number.isFinite(candidate.charactersPerSecond)
      ? Math.max(1, Math.min(120, Math.round(candidate.charactersPerSecond as number)))
      : DEFAULT_TEXT_PERFORMANCE.charactersPerSecond,
    cues: Array.isArray(candidate.cues) ? structuredClone(candidate.cues) : [],
  };
}

export function historicalNodeOpeningId(nodeId: string) {
  return `node-opening:${nodeId}:default`;
}

function canonicalOpening(value: unknown, order: number): NodeOpening | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<NodeOpening>;
  if (typeof candidate.id !== "string" || !candidate.id) return null;
  return {
    id: candidate.id,
    order: Number.isInteger(candidate.order) && (candidate.order as number) >= 0 ? candidate.order as number : order,
    condition: candidate.condition && typeof candidate.condition === "object"
      ? structuredClone(candidate.condition) as Condition
      : ALWAYS,
    narrationText: typeof candidate.narrationText === "string" ? candidate.narrationText : "",
    dialogueText: typeof candidate.dialogueText === "string" ? candidate.dialogueText : "",
    narrationPerformance: textPerformance(candidate.narrationPerformance),
    dialoguePerformance: textPerformance(candidate.dialoguePerformance),
  };
}

function normalizeNode(value: unknown): GameNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as HistoricalNode;
  if (typeof candidate.id !== "string" || !candidate.id || !Number.isInteger(candidate.nodeNumber)) return null;

  const canonicalOpenings = Array.isArray(candidate.openings)
    ? candidate.openings.flatMap((opening, index) => {
      const normalized = canonicalOpening(opening, index);
      return normalized ? [normalized] : [];
    })
    : [];

  const legacySpeakerId = typeof candidate.characterId === "string" && candidate.characterId.trim()
    ? candidate.characterId
    : null;
  const legacySpeakerText = Boolean(legacySpeakerId && candidate.dialogueText === undefined);
  const legacyPerformance = textPerformance(candidate.performance);
  const openings = canonicalOpenings.length ? canonicalOpenings : [{
    id: historicalNodeOpeningId(candidate.id),
    order: 0,
    condition: ALWAYS,
    narrationText: legacySpeakerText ? "" : typeof candidate.text === "string" ? candidate.text : "",
    dialogueText: legacySpeakerText
      ? typeof candidate.text === "string" ? candidate.text : ""
      : typeof candidate.dialogueText === "string" ? candidate.dialogueText : "",
    narrationPerformance: legacySpeakerText ? { ...DEFAULT_TEXT_PERFORMANCE, cues: [] } : legacyPerformance,
    dialoguePerformance: legacySpeakerText ? legacyPerformance : textPerformance(candidate.dialoguePerformance),
  }];

  const legacyConversationMode = candidate.conversation?.mode;
  const conversationMode = candidate.conversationMode === "set"
    || candidate.conversationMode === "continue"
    || candidate.conversationMode === "clear"
    ? candidate.conversationMode
    : legacySpeakerId
      ? "set"
      : legacyConversationMode === "set" || legacyConversationMode === "clear"
        ? legacyConversationMode
        : "continue";
  const legacyConversationIds = Array.isArray(candidate.conversation?.characterIds)
    ? candidate.conversation!.characterIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : [];
  const conversationCharacterId = conversationMode === "set"
    ? typeof candidate.conversationCharacterId === "string" && candidate.conversationCharacterId.trim()
      ? candidate.conversationCharacterId
      : legacySpeakerId ?? legacyConversationIds[0] ?? null
    : null;
  const locationMode = candidate.locationMode === "set"
    || candidate.locationMode === "continue"
    || candidate.locationMode === "clear"
    ? candidate.locationMode
    : candidate.locationId ? "set" : "continue";

  return {
    id: candidate.id,
    nodeNumber: candidate.nodeNumber as number,
    authorLabel: typeof candidate.authorLabel === "string" ? candidate.authorLabel : "",
    openings: openings
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .map((opening, order) => ({ ...opening, order })),
    ending: Boolean(candidate.ending),
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === "string") : [],
    locationId: locationMode === "set" && typeof candidate.locationId === "string" ? candidate.locationId : null,
    locationMode,
    conversationMode,
    conversationCharacterId,
    anchor: candidate.anchor && typeof candidate.anchor === "object"
      ? structuredClone(candidate.anchor)
      : { mode: "continue", text: "" },
    entryEffects: Array.isArray(candidate.entryEffects) ? structuredClone(candidate.entryEffects) : [],
  };
}

function normalizeInteraction(value: unknown): Interaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<Interaction> & Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.sourceNodeId !== "string" || !Array.isArray(candidate.outcomes)) return null;
  const outcomes = candidate.outcomes.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const historical = value as HistoricalOutcome;
    const destination = historical.destination && typeof historical.destination === "object" && !Array.isArray(historical.destination)
      ? historical.destination as { nodeId?: unknown; openingId?: unknown }
      : null;
    const nodeId = destination && typeof destination.nodeId === "string"
      ? destination.nodeId
      : typeof historical.destinationNodeId === "string"
        ? historical.destinationNodeId
        : null;
    const openingId = destination && typeof destination.openingId === "string" ? destination.openingId : null;
    const { destinationNodeId: _historicalDestinationNodeId, ...current } = historical;
    return [{
      ...current,
      destination: nodeId ? { nodeId, openingId } : null,
    } as Interaction["outcomes"][number]];
  });
  return { ...candidate, outcomes } as Interaction;
}

/**
 * One-way browser/import boundary for Narrative-owned project state.
 * Active runtime and Author code only receive canonical Nodes with openings and
 * canonical Node-entry targets; historical prose fields never cross this boundary.
 */
export function normalizeNarrativeProjectSlice(snapshot: NarrativeSnapshotLike): Pick<NarrativeProjectSlice, "nodes" | "interactions"> {
  return {
    nodes: Array.isArray(snapshot.nodes)
      ? snapshot.nodes.flatMap((node) => {
        const normalized = normalizeNode(node);
        return normalized ? [normalized] : [];
      })
      : [],
    interactions: Array.isArray(snapshot.interactions)
      ? snapshot.interactions.flatMap((interaction) => {
        const normalized = normalizeInteraction(interaction);
        return normalized ? [normalized] : [];
      })
      : [],
  };
}

/** Upgrade historical offline Narrative mutations before they re-enter runtime. */
export function normalizeNarrativeMutationOperation(operation: MutationOperation): MutationOperation {
  if (operation.type === "node.upsert") {
    const node = normalizeNode(operation.node);
    return node ? { ...operation, node } : operation;
  }
  if (operation.type === "interaction.upsert") {
    const interaction = normalizeInteraction(operation.interaction);
    return interaction ? { ...operation, interaction } : operation;
  }
  return operation;
}
