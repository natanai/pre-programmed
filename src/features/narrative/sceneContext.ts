import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { GameNode, NodeCharacterContext, NodeLocationMode } from "./model";

export type ActiveNodeLocationContext = {
  locationId: string;
  sourceNodeId: string;
};

export type ActiveNodeCharacterContext = {
  characterIds: string[];
  sourceNodeId: string;
};

export type ActiveNodeSceneContext = {
  location: ActiveNodeLocationContext | null;
  presentCharacters: ActiveNodeCharacterContext | null;
  conversation: ActiveNodeCharacterContext | null;
};

const CONTINUE_CHARACTERS: NodeCharacterContext = { mode: "continue", characterIds: [] };

function uniqueCharacterIds(characterIds: readonly string[]) {
  return [...new Set(characterIds.filter((id) => typeof id === "string" && Boolean(id.trim())))];
}

/**
 * Read old Nodes through the persistent-location contract without carrying a
 * second runtime value. Historically a locationId meant "set here" and a
 * missing location meant no authored change, which maps to Continue.
 */
export function nodeLocationMode(node: Pick<GameNode, "locationId" | "locationMode">): NodeLocationMode {
  return node.locationMode ?? (node.locationId ? "set" : "continue");
}

export function nodePresentCharacters(node: Pick<GameNode, "presentCharacters">): NodeCharacterContext {
  return node.presentCharacters ?? CONTINUE_CHARACTERS;
}

export function nodeConversation(node: Pick<GameNode, "conversation">): NodeCharacterContext {
  return node.conversation ?? CONTINUE_CHARACTERS;
}

function normalizeCharacterContext(value: NodeCharacterContext | undefined): NodeCharacterContext {
  const context = value ?? CONTINUE_CHARACTERS;
  return {
    mode: context.mode,
    characterIds: context.mode === "set" ? uniqueCharacterIds(context.characterIds ?? []) : [],
  };
}

/** Canonical persisted shape for one Node's complete traversal-derived scene directives. */
export function normalizeNodeSceneContext(node: GameNode): GameNode {
  const locationMode = nodeLocationMode(node);
  return {
    ...node,
    locationMode,
    locationId: locationMode === "set" ? node.locationId : null,
    presentCharacters: normalizeCharacterContext(node.presentCharacters),
    conversation: normalizeCharacterContext(node.conversation),
  };
}

/**
 * Resolve the hand-authored scene from the real narrative traversal. Nothing is
 * copied into PlayState: Set replaces a value, Clear removes it, and Continue
 * preserves whatever the path established earlier. The same Node can therefore
 * inherit different context when reached through different authored branches.
 */
export function resolveActiveNodeSceneContext(
  snapshot: ProjectSnapshot,
  state: Pick<PlayState, "traversal">,
): ActiveNodeSceneContext {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let location: ActiveNodeLocationContext | null = null;
  let presentCharacters: ActiveNodeCharacterContext | null = null;
  let conversation: ActiveNodeCharacterContext | null = null;

  for (const nodeId of state.traversal) {
    const node = nodesById.get(nodeId);
    if (!node) continue;

    const locationMode = nodeLocationMode(node);
    if (locationMode === "clear") location = null;
    else if (locationMode === "set") {
      location = node.locationId ? { locationId: node.locationId, sourceNodeId: node.id } : null;
    }

    const present = nodePresentCharacters(node);
    if (present.mode === "clear") presentCharacters = null;
    else if (present.mode === "set") {
      presentCharacters = {
        characterIds: uniqueCharacterIds(present.characterIds),
        sourceNodeId: node.id,
      };
    }

    const activeConversation = nodeConversation(node);
    if (activeConversation.mode === "clear") conversation = null;
    else if (activeConversation.mode === "set") {
      conversation = {
        characterIds: uniqueCharacterIds(activeConversation.characterIds),
        sourceNodeId: node.id,
      };
    }
  }

  return { location, presentCharacters, conversation };
}

/** Convenience projection retained for consumers that only need current Location. */
export function resolveActiveNodeLocationContext(
  snapshot: ProjectSnapshot,
  state: Pick<PlayState, "traversal">,
): ActiveNodeLocationContext | null {
  return resolveActiveNodeSceneContext(snapshot, state).location;
}
