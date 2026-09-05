import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { GameNode, NodeContextMode, NodeLocationMode } from "./model";

export type ActiveNodeLocationContext = {
  locationId: string;
  sourceNodeId: string;
};

export type ActiveNodeConversationContext = {
  characterId: string;
  sourceNodeId: string;
};

export type ActiveNodeContext = {
  location: ActiveNodeLocationContext | null;
  conversation: ActiveNodeConversationContext | null;
};

type LegacyNodeContext = {
  characterId?: string | null;
  presentCharacters?: { mode?: NodeContextMode; characterIds?: string[] };
  conversation?: { mode?: NodeContextMode; characterIds?: string[] };
};

/** Historical location ids meant "set here"; a missing location means Continue. */
export function nodeLocationMode(node: Pick<GameNode, "locationId" | "locationMode">): NodeLocationMode {
  return node.locationMode ?? (node.locationId ? "set" : "continue");
}

/** Read the short-lived multi-character/speaker prototype without preserving it as a current model. */
export function nodeConversationMode(node: GameNode): NodeContextMode {
  if (node.conversationMode) return node.conversationMode;
  const legacy = node as GameNode & LegacyNodeContext;
  if (legacy.characterId) return "set";
  return legacy.conversation?.mode ?? "continue";
}

export function nodeConversationCharacterId(node: GameNode): string | null {
  if (nodeConversationMode(node) !== "set") return null;
  if (node.conversationCharacterId) return node.conversationCharacterId;
  const legacy = node as GameNode & LegacyNodeContext;
  return legacy.characterId
    || legacy.conversation?.characterIds?.find((id) => typeof id === "string" && Boolean(id.trim()))
    || null;
}

/** Canonical persisted shape: only Where and Conversation travel with the Node path. */
export function normalizeNodeContext(node: GameNode): GameNode {
  const legacy = node as GameNode & LegacyNodeContext;
  const {
    characterId: _legacySpeaker,
    presentCharacters: _legacyPresence,
    conversation: _legacyConversation,
    ...current
  } = legacy;
  const locationMode = nodeLocationMode(node);
  const conversationMode = nodeConversationMode(node);
  return {
    ...current,
    locationMode,
    locationId: locationMode === "set" ? node.locationId : null,
    conversationMode,
    conversationCharacterId: conversationMode === "set" ? nodeConversationCharacterId(node) : null,
  };
}

/**
 * Resolve the hand-authored context from real narrative traversal. Set replaces,
 * Clear removes, and Continue preserves the path's prior value. No duplicate
 * runtime world state exists.
 */
export function resolveActiveNodeContext(
  snapshot: ProjectSnapshot,
  state: Pick<PlayState, "traversal">,
): ActiveNodeContext {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let location: ActiveNodeLocationContext | null = null;
  let conversation: ActiveNodeConversationContext | null = null;

  for (const nodeId of state.traversal) {
    const node = nodesById.get(nodeId);
    if (!node) continue;

    const locationMode = nodeLocationMode(node);
    if (locationMode === "clear") location = null;
    else if (locationMode === "set") {
      location = node.locationId ? { locationId: node.locationId, sourceNodeId: node.id } : null;
    }

    const conversationMode = nodeConversationMode(node);
    if (conversationMode === "clear") conversation = null;
    else if (conversationMode === "set") {
      const characterId = nodeConversationCharacterId(node);
      conversation = characterId ? { characterId, sourceNodeId: node.id } : null;
    }
  }

  return { location, conversation };
}

export function resolveActiveNodeLocationContext(
  snapshot: ProjectSnapshot,
  state: Pick<PlayState, "traversal">,
): ActiveNodeLocationContext | null {
  return resolveActiveNodeContext(snapshot, state).location;
}

export function resolveActiveNodeConversationContext(
  snapshot: ProjectSnapshot,
  state: Pick<PlayState, "traversal">,
): ActiveNodeConversationContext | null {
  return resolveActiveNodeContext(snapshot, state).conversation;
}
