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
