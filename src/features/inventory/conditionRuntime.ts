import type { ConditionHandler, ConditionValidator } from "../../engine/rules/conditionRuntime";

const hasItem: ConditionHandler = (condition, context) => {
  if (condition.type !== "has_item") return false;
  const quantity = context.state.inventory
    .filter((entry) => entry.itemId === condition.itemId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  return quantity >= (condition.minimum ?? 1);
};

const lacksItem: ConditionHandler = (condition, context) => {
  if (condition.type !== "lacks_item") return false;
  return !context.state.inventory.some((entry) => entry.itemId === condition.itemId && entry.quantity > 0);
};

const validateItem: ConditionValidator = (condition) =>
  (condition.type === "has_item" || condition.type === "lacks_item") && !condition.itemId
    ? ["Item conditions require an item."]
    : [];

export const INVENTORY_CONDITION_HANDLERS: Readonly<Record<string, ConditionHandler>> = {
  has_item: hasItem,
  lacks_item: lacksItem,
};

export const INVENTORY_CONDITION_VALIDATORS: Readonly<Record<string, ConditionValidator>> = {
  has_item: validateItem,
  lacks_item: validateItem,
};
