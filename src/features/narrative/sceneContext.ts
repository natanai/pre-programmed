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

/** Historical location ids are normalized at the project boundary before runtime. */
export function nodeLocationMode(node: Pick<GameNode, "locationId" | "locationMode">): NodeLocationMode {
  return node.locationMode ?? (node.locationId ? "set" : "continue");
}

export function nodeConversationMode(node: GameNode): NodeContextMode {
  return node.conversationMode ?? "continue";
}

export function nodeConversationCharacterId(node: GameNode): string | null {
  return nodeConversationMode(node) === "set" ? node.conversationCharacterId ?? null : null;
}

/** Canonical persisted shape: only Where and Conversation travel with the Node path. */
export function normalizeNodeContext(node: GameNode): GameNode {
  const locationMode = nodeLocationMode(node);
  const conversationMode = nodeConversationMode(node);
  return {
    ...node,
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

/** Resolve the conversation specifically at one Node on the current real traversal. */
export function resolveNodeConversationContext(
  snapshot: ProjectSnapshot,
  state: Pick<PlayState, "traversal">,
  nodeId: string,
): ActiveNodeConversationContext | null {
  const traversalIndex = state.traversal.lastIndexOf(nodeId);
  if (traversalIndex >= 0) {
    return resolveActiveNodeConversationContext(snapshot, {
      traversal: state.traversal.slice(0, traversalIndex + 1),
    });
  }
  const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || nodeConversationMode(node) !== "set") return null;
  const characterId = nodeConversationCharacterId(node);
  return characterId ? { characterId, sourceNodeId: node.id } : null;
}
