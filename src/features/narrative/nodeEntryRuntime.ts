import { authoredSource } from "../../engine/presentation/authoredSource";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { executeEffects } from "../../engine/rules/executeEffects";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import { interpolateText } from "./interpolation";

export type NodeEntryExecution = {
  state: PlayState;
  events: EffectEvent[];
};

/**
 * Executes the effects owned by a Node after runtime traversal enters it.
 * Entry effects may themselves transition, so follow that chain while keeping
 * each emitted presentation event attributed to the Node that produced it.
 */
export function executeNodeEntryEffects(
  snapshot: ProjectSnapshot,
  initialState: PlayState,
  nodeId = initialState.currentNodeId,
  maxDepth = 16,
): NodeEntryExecution {
  let state = initialState;
  const events: EffectEvent[] = [];
  let currentNodeId = nodeId;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const node = snapshot.nodes.find((candidate) => candidate.id === currentNodeId);
    if (!node) break;
    const source = authoredSource("node", node.id, { section: "entry-effects" });
    const execution = executeEffects(snapshot, state, node.entryEffects ?? [], {
      scope: { kind: "node", id: node.id },
    });
    state = execution.state;
    events.push(...execution.events.map((event) => {
      const next = event.type === "notification"
        ? { ...event, text: interpolateText(event.text, { snapshot, state }) }
        : event;
      return { ...next, source };
    }));
    if (state.currentNodeId === currentNodeId) break;
    currentNodeId = state.currentNodeId;
  }

  return { state, events };
}
