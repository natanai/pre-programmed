import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../../../author/rules/types";
import { DefinitionSelect } from "../../../author/rules/controls";

function itemLabel(snapshot: Parameters<NonNullable<EffectAuthorAdapter["summarize"]>>[1], id: string) {
  return snapshot.items.find((item) => item.id === id)?.name || "choose item";
}

function bodyBackgroundLabel(snapshot: Parameters<NonNullable<EffectAuthorAdapter["summarize"]>>[1], id: string) {
  if (!id) return "no body background";
  return (snapshot.bodyBackgrounds ?? []).find((background) => background.id === id)?.name || "choose body background";
}

export const hasItemConditionAdapter: ConditionAuthorAdapter = {
  type: "has_item",
  label: "has item",
  create: () => ({ type: "has_item", itemId: "", minimum: 1 }),
  render: ({ condition, onChange, snapshot }) => {
    if (condition.type !== "has_item") return null;
    return <>
      <select value={condition.itemId} onChange={(event) => onChange({ ...condition, itemId: event.target.value })}>
        <option value="">choose item</option>
        {snapshot.items.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>
      <input aria-label="Minimum quantity" type="number" min={1} value={condition.minimum ?? 1} onChange={(event) => onChange({ ...condition, minimum: Number(event.target.value) })} />
    </>;
  },
};

export const lacksItemConditionAdapter: ConditionAuthorAdapter = {
  type: "lacks_item",
  label: "lacks item",
  create: () => ({ type: "lacks_item", itemId: "" }),
  render: ({ condition, onChange, snapshot }) => {
    if (condition.type !== "lacks_item") return null;
    return <select value={condition.itemId} onChange={(event) => onChange({ ...condition, itemId: event.target.value })}>
      <option value="">choose item</option>
      {snapshot.items.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
    </select>;
  },
};

export const giveItemEffectAdapter: EffectAuthorAdapter = {
  type: "give_item",
  label: "give item",
  create: () => ({ id: crypto.randomUUID(), type: "give_item", itemId: "", quantity: 1 }),
  summarize: (effect, snapshot) => effect.type === "give_item" ? `Give ${itemLabel(snapshot, effect.itemId)} ×${effect.quantity}` : "Give item",
  render: ({ effect, onChange, snapshot }) => effect.type === "give_item" ? <>
    <DefinitionSelect value={effect.itemId} definitions={snapshot.items} valueMode="id" onChange={(itemId) => onChange({ ...effect, itemId })} />
    <input type="number" min={1} value={effect.quantity} onChange={(event) => onChange({ ...effect, quantity: Number(event.target.value) })} />
  </> : null,
};

export const removeItemEffectAdapter: EffectAuthorAdapter = {
  type: "remove_item",
  label: "remove item",
  create: () => ({ id: crypto.randomUUID(), type: "remove_item", itemId: "", quantity: 1 }),
  summarize: (effect, snapshot) => effect.type === "remove_item" ? `Remove ${itemLabel(snapshot, effect.itemId)} ×${effect.quantity}` : "Remove item",
  render: ({ effect, onChange, snapshot }) => effect.type === "remove_item" ? <>
    <DefinitionSelect value={effect.itemId} definitions={snapshot.items} valueMode="id" onChange={(itemId) => onChange({ ...effect, itemId })} />
    <input type="number" min={1} value={effect.quantity} onChange={(event) => onChange({ ...effect, quantity: Number(event.target.value) })} />
  </> : null,
};

export const setItemStateEffectAdapter: EffectAuthorAdapter = {
  type: "set_item_state",
  label: "change item state",
  create: () => ({ id: crypto.randomUUID(), type: "set_item_state", itemId: "", key: "", value: "" }),
  summarize: (effect, snapshot) => effect.type === "set_item_state"
    ? `${itemLabel(snapshot, effect.itemId)} · ${effect.key || "state"} = ${String(effect.value ?? "")}`
    : "Change item state",
  render: ({ effect, onChange, snapshot }) => effect.type === "set_item_state" ? <>
    <DefinitionSelect value={effect.itemId} definitions={snapshot.items} valueMode="id" onChange={(itemId) => onChange({ ...effect, itemId })} />
    <input placeholder="state key" value={effect.key} onChange={(event) => onChange({ ...effect, key: event.target.value })} />
    <input placeholder="value" value={String(effect.value ?? "")} onChange={(event) => onChange({ ...effect, value: event.target.value })} />
  </> : null,
};

export const setBodyBackgroundEffectAdapter: EffectAuthorAdapter = {
  type: "set_body_background",
  label: "set body background",
  create: () => ({ id: crypto.randomUUID(), type: "set_body_background", backgroundId: "" }),
  summarize: (effect, snapshot) => effect.type === "set_body_background"
    ? `Body background → ${bodyBackgroundLabel(snapshot, effect.backgroundId)}`
    : "Set body background",
  render: ({ effect, onChange, snapshot }) => effect.type === "set_body_background" ? <select
    value={effect.backgroundId}
    onChange={(event) => onChange({ ...effect, backgroundId: event.target.value })}
  >
    <option value="">none</option>
    {(snapshot.bodyBackgrounds ?? []).map((background) => <option value={background.id} key={background.id}>{background.name}</option>)}
  </select> : null,
};
