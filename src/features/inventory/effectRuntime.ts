import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";
import { addInventoryItem, removeInventoryItem } from "./runtime";

const giveItem: EffectHandler = (effect, snapshot, state) => {
  if (effect.type !== "give_item") return unchangedEffect(state);
  return { state: addInventoryItem(snapshot, state, effect.itemId, effect.quantity), events: [] };
};

const removeItem: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "remove_item") return unchangedEffect(state);
  return { state: removeInventoryItem(state, effect.itemId, effect.quantity), events: [] };
};

const setItemState: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "set_item_state") return unchangedEffect(state);
  return {
    state: {
      ...state,
      inventory: state.inventory.map((entry) =>
        entry.itemId === effect.itemId
          ? { ...entry, state: { ...entry.state, [effect.key]: effect.value } }
          : entry,
      ),
    },
    events: [],
  };
};

const setBodyBackground: EffectHandler = (effect, snapshot, state) => {
  if (effect.type !== "set_body_background") return unchangedEffect(state);
  if (effect.backgroundId && !(snapshot.bodyBackgrounds ?? []).some((background) => background.id === effect.backgroundId)) {
    return unchangedEffect(state);
  }
  return {
    state: { ...state, bodyBackgroundId: effect.backgroundId || null },
    events: [],
  };
};

export const INVENTORY_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  give_item: giveItem,
  remove_item: removeItem,
  set_item_state: setItemState,
  set_body_background: setBodyBackground,
};
