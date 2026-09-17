import type { MutationOperation } from "../../engine/project/model";
import type { Condition, Effect } from "../../engine/rules/model";
import type {
  GameNode,
  Interaction,
  NarrativeFlowStep,
  NodeEntryTarget,
  NodeOpening,
  TextPerformance,
} from "./model";
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
  disposition?: unknown;
  inputCapture?: unknown;
  after?: unknown;
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

function destination(value: unknown): NodeEntryTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { nodeId?: unknown; openingId?: unknown };
  if (typeof candidate.nodeId !== "string" || !candidate.nodeId) return null;
  return {
    nodeId: candidate.nodeId,
    openingId: typeof candidate.openingId === "string" && candidate.openingId ? candidate.openingId : null,
  };
}

function flowStep(value: unknown, index: number): NarrativeFlowStep | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === "string" && candidate.id ? candidate.id : `flow-step:${index}`;
  if (candidate.type === "await_input") return { id, type: "await_input" };
  if (candidate.type === "effects") {
    return {
      id,
      type: "effects",
      effects: Array.isArray(candidate.effects) ? structuredClone(candidate.effects) as Effect[] : [],
    };
  }
  if (candidate.type === "present") {
    return {
      id,
      type: "present",
      responseText: typeof candidate.responseText === "string" ? candidate.responseText : "",
      dialogueText: typeof candidate.dialogueText === "string" ? candidate.dialogueText : "",
      speakerId: typeof candidate.speakerId === "string" ? candidate.speakerId : null,
      responsePerformance: textPerformance(candidate.responsePerformance),
      dialoguePerformance: textPerformance(candidate.dialoguePerformance),
    };
  }
  if (candidate.type === "transition") {
    const target = destination(candidate.destination);
    return target ? { id, type: "transition", destination: target } : null;
  }
  return null;
}

function canonicalFlow(value: unknown): NarrativeFlowStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step, index) => {
    const normalized = flowStep(step, index);
    return normalized ? [normalized] : [];
  });
}

function historicalOutcomeDestination(outcome: HistoricalOutcome) {
  const direct = destination(outcome.destination);
  if (direct) return direct;
  return typeof outcome.destinationNodeId === "string" && outcome.destinationNodeId
    ? { nodeId: outcome.destinationNodeId, openingId: null }
    : null;
}

function historicalOutcomeAfter(outcome: HistoricalOutcome): NarrativeFlowStep[] {
  if (Array.isArray(outcome.after)) return canonicalFlow(outcome.after);

  const directDestination = historicalOutcomeDestination(outcome);
  const capture = outcome.inputCapture && typeof outcome.inputCapture === "object" && !Array.isArray(outcome.inputCapture)
    ? outcome.inputCapture as Record<string, unknown>
    : null;

  if (capture) {
    const captureDestination = destination(capture.destination);
    return [
      { id: `legacy-flow:${String(outcome.id ?? "outcome")}:await`, type: "await_input" },
      {
        id: `legacy-flow:${String(outcome.id ?? "outcome")}:effects`,
        type: "effects",
        effects: Array.isArray(capture.effects) ? structuredClone(capture.effects) as Effect[] : [],
      },
      {
        id: `legacy-flow:${String(outcome.id ?? "outcome")}:present`,
        type: "present",
        responseText: "",
        dialogueText: "",
        speakerId: null,
        responsePerformance: { ...DEFAULT_TEXT_PERFORMANCE, cues: [] },
        dialoguePerformance: { ...DEFAULT_TEXT_PERFORMANCE, cues: [] },
      },
      ...(capture.disposition === "transition" && captureDestination
        ? [{
            id: `legacy-flow:${String(outcome.id ?? "outcome")}:transition`,
            type: "transition" as const,
            destination: captureDestination,
          }]
        : []),
    ];
  }

  return outcome.disposition === "transition" && directDestination
    ? [{
        id: `legacy-flow:${String(outcome.id ?? "outcome")}:transition`,
        type: "transition",
        destination: directDestination,
      }]
    : [];
}

function legacyCaptureFlow(outcome: HistoricalOutcome): NarrativeFlowStep[] {
  const directDestination = historicalOutcomeDestination(outcome);
  const effects = Array.isArray(outcome.effects) ? structuredClone(outcome.effects) as Effect[] : [];
  const responseText = typeof outcome.responseText === "string" ? outcome.responseText : "";
  const dialogueText = typeof outcome.dialogueText === "string" ? outcome.dialogueText : "";
  const speakerId = typeof outcome.speakerId === "string" ? outcome.speakerId : null;
  const id = String(outcome.id ?? "legacy-capture");
  return [
    { id: `legacy-capture:${id}:await`, type: "await_input" },
    { id: `legacy-capture:${id}:effects`, type: "effects", effects },
    {
      id: `legacy-capture:${id}:present`,
      type: "present",
      responseText,
      dialogueText,
      speakerId,
      responsePerformance: textPerformance(outcome.responsePerformance),
      dialoguePerformance: textPerformance(outcome.dialoguePerformance),
    },
    ...(outcome.disposition === "transition" && directDestination
      ? [{ id: `legacy-capture:${id}:transition`, type: "transition" as const, destination: directDestination }]
      : []),
  ];
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
    after: canonicalFlow(candidate.after),
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
    after: [],
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

function normalizeOutcome(value: unknown): Interaction["outcomes"][number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const historical = value as HistoricalOutcome;
  if (typeof historical.id !== "string" || !historical.id) return null;
  const {
    destinationNodeId: _destinationNodeId,
    destination: _destination,
    disposition: _disposition,
    inputCapture: _inputCapture,
    after: _after,
    ...current
  } = historical;
  return {
    ...current,
    id: historical.id,
    after: historicalOutcomeAfter(historical),
  } as Interaction["outcomes"][number];
}

function normalizeInteraction(value: unknown): Interaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<Interaction> & Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.sourceNodeId !== "string" || !Array.isArray(candidate.outcomes)) return null;
  if ((value as Record<string, unknown>).matchMode === "capture") return null;
  const outcomes = candidate.outcomes.flatMap((outcome) => {
    const normalized = normalizeOutcome(outcome);
    return normalized ? [normalized] : [];
  });
  return {
    ...candidate,
    matchMode: candidate.matchMode === "fallback" ? "fallback" : "command",
    outcomes,
  } as Interaction;
}

function applyLegacyCaptureInteractions(nodes: GameNode[], interactions: unknown[]) {
  const nextNodes = structuredClone(nodes);
  for (const value of interactions) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const candidate = value as Record<string, unknown>;
    if (candidate.matchMode !== "capture" || typeof candidate.sourceNodeId !== "string" || !Array.isArray(candidate.outcomes)) continue;
    const node = nextNodes.find((item) => item.id === candidate.sourceNodeId);
    const opening = node?.openings[0];
    const outcome = candidate.outcomes
      .map((item) => item && typeof item === "object" && !Array.isArray(item) ? item as HistoricalOutcome : null)
      .find(Boolean);
    if (!node || !opening || !outcome || opening.after.length) continue;
    opening.after = legacyCaptureFlow(outcome);
  }
  return nextNodes;
}

/**
 * One-way browser/import boundary for Narrative-owned project state.
 * Active runtime and Author code only receive canonical Nodes/openings/flows;
 * superseded capture/disposition fields never cross this boundary.
 */
export function normalizeNarrativeProjectSlice(snapshot: NarrativeSnapshotLike): Pick<NarrativeProjectSlice, "nodes" | "interactions"> {
  const rawInteractions = Array.isArray(snapshot.interactions) ? snapshot.interactions : [];
  const nodes = Array.isArray(snapshot.nodes)
    ? snapshot.nodes.flatMap((node) => {
      const normalized = normalizeNode(node);
      return normalized ? [normalized] : [];
    })
    : [];
  return {
    nodes: applyLegacyCaptureInteractions(nodes, rawInteractions),
    interactions: rawInteractions.flatMap((interaction) => {
      const normalized = normalizeInteraction(interaction);
      return normalized ? [normalized] : [];
    }),
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
