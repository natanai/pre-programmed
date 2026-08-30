import { addInventoryItem, removeInventoryItem } from "./inventory";
import type { Effect, PlayState, ProjectSnapshot, Value } from "./model";

export type EffectEvent =
  | { type: "notification"; text: string }
  | { type: "synth"; synthId: string }
  | { type: "audio"; assetPath: string }
  | { type: "art"; assetPath: string };

export type EffectExecution = {
  state: PlayState;
  events: EffectEvent[];
};

function numericValue(value: Value | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function executeEffects(
  snapshot: ProjectSnapshot,
  initialState: PlayState,
  effects: Effect[],
): EffectExecution {
  let state: PlayState = initialState;
  const events: EffectEvent[] = [];

  for (const effect of effects) {
    switch (effect.type) {
      case "set_flag":
        state = { ...state, values: { ...state.values, [effect.key]: true } };
        break;
      case "clear_flag":
        state = { ...state, values: { ...state.values, [effect.key]: false } };
        break;
      case "set_value":
        state = { ...state, values: { ...state.values, [effect.key]: effect.value } };
        break;
      case "increment":
        state = {
          ...state,
          values: { ...state.values, [effect.key]: numericValue(state.values[effect.key]) + effect.amount },
        };
        break;
      case "decrement":
        state = {
          ...state,
          values: { ...state.values, [effect.key]: numericValue(state.values[effect.key]) - effect.amount },
        };
        break;
      case "give_item":
        state = addInventoryItem(snapshot, state, effect.itemId, effect.quantity);
        break;
      case "remove_item":
        state = removeInventoryItem(state, effect.itemId, effect.quantity);
        break;
      case "set_item_state":
        state = {
          ...state,
          inventory: state.inventory.map((entry) =>
            entry.itemId === effect.itemId
              ? { ...entry, state: { ...entry.state, [effect.key]: effect.value } }
              : entry,
          ),
        };
        break;
      case "set_interaction_visibility":
        state = {
          ...state,
          interactionVisibility: {
            ...state.interactionVisibility,
            [effect.interactionId]: effect.visible,
          },
        };
        break;
      case "notification":
        events.push({ type: "notification", text: effect.text });
        break;
      case "synth":
        events.push({ type: "synth", synthId: effect.synthId });
        break;
      case "audio":
        events.push({ type: "audio", assetPath: effect.assetPath });
        break;
      case "art":
        events.push({ type: "art", assetPath: effect.assetPath });
        break;
      case "transition":
        state = transitionState(state, effect.nodeId);
        break;
    }
  }
  return { state, events };
}

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
