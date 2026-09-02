import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../../../author/rules/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";

export const hasItemConditionAdapter: ConditionAuthorAdapter = {
  type: "has_item", label: "has item", create: () => ({ type: "has_item", itemId: "", minimum: 1 }),
  references: (condition) => condition.type === "has_item" && condition.itemId ? [{ resourceKind: "item", resourceId: condition.itemId, detail: "item condition" }] : [],
  render: ({ condition, onChange }) => condition.type === "has_item" ? <><ReferenceField kind="item" value={condition.itemId} onChange={(itemId) => onChange({ ...condition, itemId })} /><input type="number" min={1} value={condition.minimum ?? 1} onChange={(event) => onChange({ ...condition, minimum: Math.max(1, Number(event.target.value)) })} /></> : null,
};
export const lacksItemConditionAdapter: ConditionAuthorAdapter = {
  type: "lacks_item", label: "lacks item", create: () => ({ type: "lacks_item", itemId: "" }),
  references: (condition) => condition.type === "lacks_item" && condition.itemId ? [{ resourceKind: "item", resourceId: condition.itemId, detail: "item condition" }] : [],
  render: ({ condition, onChange }) => condition.type === "lacks_item" ? <ReferenceField kind="item" value={condition.itemId} onChange={(itemId) => onChange({ ...condition, itemId })} /> : null,
};
export const giveItemEffectAdapter: EffectAuthorAdapter = {
  type: "give_item", label: "give item", category: "inventory", description: "Give the player an authored item.", create: () => ({ id: crypto.randomUUID(), type: "give_item", itemId: "", quantity: 1 }),
  references: (effect) => effect.type === "give_item" && effect.itemId ? [{ resourceKind: "item", resourceId: effect.itemId, detail: "give item" }] : [],
  summarize: (effect, snapshot) => effect.type === "give_item" ? `Give ${snapshot.items.find((item) => item.id === effect.itemId)?.name || "item"} ×${effect.quantity}` : "Give item",
  render: ({ effect, onChange }) => effect.type === "give_item" ? <><ReferenceField kind="item" value={effect.itemId} onChange={(itemId) => onChange({ ...effect, itemId })} /><input type="number" min={1} value={effect.quantity} onChange={(event) => onChange({ ...effect, quantity: Math.max(1, Number(event.target.value)) })} /></> : null,
};
export const removeItemEffectAdapter: EffectAuthorAdapter = {
  type: "remove_item", label: "remove item", category: "inventory", description: "Remove an authored item from the player's possessions.", create: () => ({ id: crypto.randomUUID(), type: "remove_item", itemId: "", quantity: 1 }),
  references: (effect) => effect.type === "remove_item" && effect.itemId ? [{ resourceKind: "item", resourceId: effect.itemId, detail: "remove item" }] : [],
  summarize: (effect, snapshot) => effect.type === "remove_item" ? `Remove ${snapshot.items.find((item) => item.id === effect.itemId)?.name || "item"} ×${effect.quantity}` : "Remove item",
  render: ({ effect, onChange }) => effect.type === "remove_item" ? <><ReferenceField kind="item" value={effect.itemId} onChange={(itemId) => onChange({ ...effect, itemId })} /><input type="number" min={1} value={effect.quantity} onChange={(event) => onChange({ ...effect, quantity: Math.max(1, Number(event.target.value)) })} /></> : null,
};
export const setItemStateEffectAdapter: EffectAuthorAdapter = {
  type: "set_item_state", label: "set item state", category: "inventory", description: "Set per-instance state on every held copy of an item.", create: () => ({ id: crypto.randomUUID(), type: "set_item_state", itemId: "", key: "state", value: true }),
  references: (effect) => effect.type === "set_item_state" && effect.itemId ? [{ resourceKind: "item", resourceId: effect.itemId, detail: "item state" }] : [],
  summarize: (effect, snapshot) => effect.type === "set_item_state" ? `${snapshot.items.find((item) => item.id === effect.itemId)?.name || "item"}.${effect.key} = ${String(effect.value)}` : "Set item state",
  render: ({ effect, onChange }) => effect.type === "set_item_state" ? <><ReferenceField kind="item" value={effect.itemId} onChange={(itemId) => onChange({ ...effect, itemId })} /><input value={effect.key} onChange={(event) => onChange({ ...effect, key: event.target.value })} /><input value={String(effect.value ?? "")} onChange={(event) => onChange({ ...effect, value: event.target.value })} /></> : null,
};
