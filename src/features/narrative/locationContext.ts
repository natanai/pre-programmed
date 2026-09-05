import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { GameNode, NodeLocationMode } from "./model";

export type ActiveNodeLocationContext = {
  locationId: string;
  sourceNodeId: string;
};

/**
 * Read old Nodes through the new persistent-location contract without carrying
 * a second runtime value. Historically a locationId meant "set here" and a
 * missing location meant no authored change, which now maps cleanly to Continue.
 */
export function nodeLocationMode(node: Pick<GameNode, "locationId" | "locationMode">): NodeLocationMode {
  return node.locationMode ?? (node.locationId ? "set" : "continue");
}

/** Canonical persisted shape for one Node's location directive. */
export function normalizeNodeLocationContext<T extends Pick<GameNode, "locationId" | "locationMode">>(node: T): T {
  const locationMode = nodeLocationMode(node);
  return {
    ...node,
    locationMode,
    locationId: locationMode === "set" ? node.locationId : null,
  };
}

/**
 * Resolve Location context from the real narrative traversal, like Node anchors.
 * Set replaces the active location, Clear removes it, and Continue preserves it.
 * Nothing is duplicated into PlayState, so save/resume and branching use the
 * same traversal source of truth as ordinary play.
 */
export function resolveActiveNodeLocationContext(
  snapshot: ProjectSnapshot,
  state: PlayState,
): ActiveNodeLocationContext | null {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let active: ActiveNodeLocationContext | null = null;

  for (const nodeId of state.traversal) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const mode = nodeLocationMode(node);
    if (mode === "continue") continue;
    if (mode === "clear") {
      active = null;
      continue;
    }
    active = node.locationId ? { locationId: node.locationId, sourceNodeId: node.id } : null;
  }

  return active;
}
