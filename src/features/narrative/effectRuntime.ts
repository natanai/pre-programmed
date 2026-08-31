import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";
import type { PlayState } from "../../engine/project/model";

export function transitionState(state: PlayState, nodeId: string): PlayState {
  return {
    ...state,
    currentNodeId: nodeId,
    traversal: [...state.traversal, nodeId],
    visitedNodeIds: state.visitedNodeIds.includes(nodeId)
      ? state.visitedNodeIds
      : [...state.visitedNodeIds, nodeId],
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
