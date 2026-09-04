import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { interpolateText } from "./interpolation";

export type ActiveNodeAnchor = {
  text: string;
  sourceNodeId: string;
};

/**
 * Resolve the current authored anchor from the real narrative traversal.
 *
 * `set` replaces the active anchor, `clear` removes it, and missing/`continue`
 * values preserve the previous anchor. Deriving this instead of storing a
 * second mutable runtime value keeps save/resume and navigation on one source
 * of truth.
 */
export function resolveActiveNodeAnchor(
  snapshot: ProjectSnapshot,
  state: PlayState,
): ActiveNodeAnchor | null {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let active: ActiveNodeAnchor | null = null;

  for (const nodeId of state.traversal) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const anchor = node.anchor;
    if (!anchor || anchor.mode === "continue") continue;
    if (anchor.mode === "clear") {
      active = null;
      continue;
    }

    const text = interpolateText(anchor.text, { snapshot, state });
    active = text.trim() ? { text, sourceNodeId: node.id } : null;
  }

  return active;
}
