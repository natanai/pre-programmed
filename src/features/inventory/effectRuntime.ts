import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";
import { applyPossessionGrantExtensions, applyPossessionRemovalExtensions } from "../../engine/possessions/catalog";
import { addInventoryItem, INVENTORY_POSSESSION_SERVICES, removeInventoryItem } from "./runtime";

function removedInstanceIds(before: Parameters<EffectHandler>[2], after: Parameters<EffectHandler>[2]) {
  const remaining = new Set(after.inventory.map((entry) => entry.instanceId));
  return before.inventory.filter((entry) => !remaining.has(entry.instanceId)).map((entry) => entry.instanceId);
}

const giveItem: EffectHandler = (effect, snapshot, state) => {
  if (effect.type !== "give_item") return unchangedEffect(state);
  const granted = addInventoryItem(snapshot, state, effect.itemId, effect.quantity);
  return { state: applyPossessionGrantExtensions(snapshot, state, granted, effect.itemId, INVENTORY_POSSESSION_SERVICES), events: [] };
};
const removeItem: EffectHandler = (effect, snapshot, state) => {
  if (effect.type !== "remove_item") return unchangedEffect(state);
  const removedState = removeInventoryItem(state, effect.itemId, effect.quantity);
  return { state: applyPossessionRemovalExtensions(snapshot, state, removedState, removedInstanceIds(state, removedState), INVENTORY_POSSESSION_SERVICES), events: [] };
};
const setItemState: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "set_item_state") return unchangedEffect(state);
  return { state: { ...state, inventory: state.inventory.map((entry) => entry.itemId === effect.itemId ? { ...entry, state: { ...entry.state, [effect.key]: effect.value } } : entry) }, events: [] };
};

export const INVENTORY_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  give_item: giveItem,
  remove_item: removeItem,
  set_item_state: setItemState,
};
