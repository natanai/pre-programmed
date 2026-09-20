import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";
import type { PlayState } from "../../engine/project/model";
import type { NodeEntryTarget } from "./model";

export function transitionState(state: PlayState, target: string | NodeEntryTarget): PlayState {
  const entry = typeof target === "string" ? { nodeId: target, openingId: null } : target;
  return {
    ...state,
    currentNodeId: entry.nodeId,
    currentNodeOpeningId: entry.openingId,
    traversal: [...state.traversal, entry.nodeId],
    visitedNodeIds: state.visitedNodeIds.includes(entry.nodeId)
      ? state.visitedNodeIds
      : [...state.visitedNodeIds, entry.nodeId],
  };
}

/**
 * Return through actual runtime traversal rather than linking to a fixed Node.
 * This pops the current traversal frame, so repeated RETURN actions continue
 * walking back instead of bouncing between duplicated history entries.
 */
export function returnToPreviousNodeState(state: PlayState): PlayState {
  const currentIndex = state.traversal.lastIndexOf(state.currentNodeId);
  const previousIndex = currentIndex > 0 ? currentIndex - 1 : state.traversal.length - 2;
  if (previousIndex < 0) return state;
  const nodeId = state.traversal[previousIndex];
  if (!nodeId) return state;
  return {
    ...state,
    currentNodeId: nodeId,
    currentNodeOpeningId: null,
    traversal: state.traversal.slice(0, previousIndex + 1),
  };
}

const interactionVisibility: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "set_interaction_visibility") return unchangedEffect(state);
  return {
    state: {
      ...state,
      interactionVisibility: {
        ...state.interactionVisibility,
        [effect.interactionId]: effect.visible,
      },
    },
    events: [],
  };
};

const transition: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "transition") return unchangedEffect(state);
  return { state: transitionState(state, effect.nodeId), events: [] };
};

export const NARRATIVE_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  set_interaction_visibility: interactionVisibility,
  transition,
};
