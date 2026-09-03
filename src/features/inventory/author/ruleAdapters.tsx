import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../../../author/rules/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";

function itemLabel(snapshot: Parameters<NonNullable<EffectAuthorAdapter["summarize"]>>[1], id: string) {
  return snapshot.items.find((item) => item.id === id)?.name || "choose item";
}

function bodyTypeLabel(snapshot: Parameters<NonNullable<EffectAuthorAdapter["summarize"]>>[1], id: string) {
  if (!id) return "no body type";
  return (snapshot.bodyBackgrounds ?? []).find((bodyType) => bodyType.id === id)?.name || "choose body type";
}

export const hasItemConditionAdapter: ConditionAuthorAdapter = {
  type: "has_item",
  label: "has item",
  create: () => ({ type: "has_item", itemId: "", minimum: 1 }),
  references: (condition) => condition.type === "has_item" && condition.itemId ? [{ resourceKind: "item", resourceId: condition.itemId, detail: "required item" }] : [],
  render: ({ condition, onChange }) => {
    if (condition.type !== "has_item") return null;
    return <>
      <ReferenceField kind="item" value={condition.itemId} onChange={(itemId) => onChange({ ...condition, itemId })} />
      <input aria-label="Minimum quantity" type="number" min={1} value={condition.minimum ?? 1} onChange={(event) => onChange({ ...condition, minimum: Number(event.target.value) })} />
    </>;
  },
};

export const lacksItemConditionAdapter: ConditionAuthorAdapter = {
  type: "lacks_item",
  label: "lacks item",
  create: () => ({ type: "lacks_item", itemId: "" }),
  references: (condition) => condition.type === "lacks_item" && condition.itemId ? [{ resourceKind: "item", resourceId: condition.itemId, detail: "excluded item" }] : [],
  render: ({ condition, onChange }) => condition.type === "lacks_item"
    ? <ReferenceField kind="item" value={condition.itemId} onChange={(itemId) => onChange({ ...condition, itemId })} />
    : null,
};

export const giveItemEffectAdapter: EffectAuthorAdapter = {
  type: "give_item",
  label: "give item",
  category: "inventory & body",
  description: "Give the player an item; its authored on-give equipment rule can run automatically.",
  create: () => ({ id: crypto.randomUUID(), type: "give_item", itemId: "", quantity: 1 }),
  references: (effect) => effect.type === "give_item" && effect.itemId ? [{ resourceKind: "item", resourceId: effect.itemId, detail: "item to give" }] : [],
  summarize: (effect, snapshot) => effect.type === "give_item" ? `Give ${itemLabel(snapshot, effect.itemId)} ×${effect.quantity}` : "Give item",
  render: ({ effect, onChange }) => effect.type === "give_item" ? <>
    <ReferenceField kind="item" value={effect.itemId} onChange={(itemId) => onChange({ ...effect, itemId })} />
    <input type="number" min={1} value={effect.quantity} onChange={(event) => onChange({ ...effect, quantity: Number(event.target.value) })} />
  </> : null,
};

export const removeItemEffectAdapter: EffectAuthorAdapter = {
  type: "remove_item",
  label: "remove item",
  category: "inventory & body",
  description: "Remove a quantity of an item from the player.",
  create: () => ({ id: crypto.randomUUID(), type: "remove_item", itemId: "", quantity: 1 }),
  references: (effect) => effect.type === "remove_item" && effect.itemId ? [{ resourceKind: "item", resourceId: effect.itemId, detail: "item to remove" }] : [],
  summarize: (effect, snapshot) => effect.type === "remove_item" ? `Remove ${itemLabel(snapshot, effect.itemId)} ×${effect.quantity}` : "Remove item",
  render: ({ effect, onChange }) => effect.type === "remove_item" ? <>
    <ReferenceField kind="item" value={effect.itemId} onChange={(itemId) => onChange({ ...effect, itemId })} />
    <input type="number" min={1} value={effect.quantity} onChange={(event) => onChange({ ...effect, quantity: Number(event.target.value) })} />
  </> : null,
};

export const setItemStateEffectAdapter: EffectAuthorAdapter = {
  type: "set_item_state",
  label: "change item state",
  category: "inventory & body",
  description: "Change one authored state field on the player's item.",
  create: () => ({ id: crypto.randomUUID(), type: "set_item_state", itemId: "", key: "", value: "" }),
  references: (effect) => effect.type === "set_item_state" && effect.itemId ? [{ resourceKind: "item", resourceId: effect.itemId, detail: "item state target" }] : [],
  summarize: (effect, snapshot) => effect.type === "set_item_state"
    ? `${itemLabel(snapshot, effect.itemId)} · ${effect.key || "state"} = ${String(effect.value ?? "")}`
    : "Change item state",
  render: ({ effect, onChange }) => effect.type === "set_item_state" ? <>
    <ReferenceField kind="item" value={effect.itemId} onChange={(itemId) => onChange({ ...effect, itemId })} />
    <input placeholder="state key" value={effect.key} onChange={(event) => onChange({ ...effect, key: event.target.value })} />
    <input placeholder="value" value={String(effect.value ?? "")} onChange={(event) => onChange({ ...effect, value: event.target.value })} />
  </> : null,
};

export const setBodyBackgroundEffectAdapter: EffectAuthorAdapter = {
  type: "set_body_background",
  label: "set body type",
  category: "inventory & body",
  description: "Activate a body type and its slot layout.",
  create: () => ({ id: crypto.randomUUID(), type: "set_body_background", backgroundId: "" }),
  references: (effect) => effect.type === "set_body_background" && effect.backgroundId ? [{ resourceKind: "body-type", resourceId: effect.backgroundId, detail: "body type to activate" }] : [],
  summarize: (effect, snapshot) => effect.type === "set_body_background"
    ? `Body type → ${bodyTypeLabel(snapshot, effect.backgroundId)}`
    : "Set body type",
  render: ({ effect, onChange }) => effect.type === "set_body_background"
    ? <ReferenceField kind="body-type" value={effect.backgroundId} onChange={(backgroundId) => onChange({ ...effect, backgroundId })} placeholder="none / choose body type" />
    : null,
};
