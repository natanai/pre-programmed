import type { Value } from "../../../engine/rules/model";
import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../../../author/rules/types";
import { ComparisonSelect } from "../../../author/rules/controls";
import { ReferenceField } from "../../../author/resources/ReferenceField";

function parseValue(value: string, sample: Value): Value {
  if (typeof sample === "number") return Number(value);
  if (typeof sample === "boolean") return value === "true";
  return value;
}

function valueLabel(snapshot: Parameters<NonNullable<EffectAuthorAdapter["summarize"]>>[1], key: string) {
  return snapshot.valueDefinitions.find((item) => item.key === key)?.label || key || "choose value";
}

export const flagConditionAdapter: ConditionAuthorAdapter = {
  type: "flag",
  label: "flag",
  create: () => ({ type: "flag", key: "", value: true }),
  references: (condition) => condition.type === "flag" && condition.key ? [{ resourceKind: "flag", resourceId: condition.key, detail: "flag condition" }] : [],
  render: ({ condition, onChange }) => condition.type === "flag" ? <>
    <ReferenceField kind="flag" value={condition.key} onChange={(key) => onChange({ ...condition, key })} />
    <select value={String(condition.value)} onChange={(event) => onChange({ ...condition, value: event.target.value === "true" })}>
      <option value="true">is true</option><option value="false">is false</option>
    </select>
  </> : null,
};

export const variableConditionAdapter: ConditionAuthorAdapter = {
  type: "variable",
  label: "value comparison",
  create: () => ({ type: "variable", key: "", operator: "eq", value: 0 }),
  references: (condition) => condition.type === "variable" && condition.key ? [{ resourceKind: "value", resourceId: condition.key, detail: "value condition" }] : [],
  render: ({ condition, onChange, snapshot }) => {
    if (condition.type !== "variable") return null;
    return <>
      <ReferenceField kind="value" value={condition.key} onChange={(key) => {
        const definition = snapshot.valueDefinitions.find((item) => item.key === key);
        onChange({ ...condition, key, value: definition?.initialValue ?? 0 });
      }} />
      <ComparisonSelect value={condition.operator} onChange={(operator) => onChange({ ...condition, operator })} />
      <input aria-label="Comparison value" value={String(condition.value ?? "")} onChange={(event) => onChange({ ...condition, value: parseValue(event.target.value, condition.value) })} />
    </>;
  },
};

export const setFlagEffectAdapter: EffectAuthorAdapter = {
  type: "set_flag", label: "set flag", category: "values", description: "Turn an authored boolean value on.",
  create: () => ({ id: crypto.randomUUID(), type: "set_flag", key: "" }),
  references: (effect) => effect.type === "set_flag" && effect.key ? [{ resourceKind: "flag", resourceId: effect.key, detail: "flag effect" }] : [],
  summarize: (effect, snapshot) => effect.type === "set_flag" ? `Set ${valueLabel(snapshot, effect.key)} true` : "Set flag",
  render: ({ effect, onChange }) => effect.type === "set_flag" ? <ReferenceField kind="flag" value={effect.key} onChange={(key) => onChange({ ...effect, key })} /> : null,
};
export const clearFlagEffectAdapter: EffectAuthorAdapter = {
  type: "clear_flag", label: "clear flag", category: "values", description: "Turn an authored boolean value off.",
  create: () => ({ id: crypto.randomUUID(), type: "clear_flag", key: "" }),
  references: (effect) => effect.type === "clear_flag" && effect.key ? [{ resourceKind: "flag", resourceId: effect.key, detail: "flag effect" }] : [],
  summarize: (effect, snapshot) => effect.type === "clear_flag" ? `Set ${valueLabel(snapshot, effect.key)} false` : "Clear flag",
  render: ({ effect, onChange }) => effect.type === "clear_flag" ? <ReferenceField kind="flag" value={effect.key} onChange={(key) => onChange({ ...effect, key })} /> : null,
};
export const setValueEffectAdapter: EffectAuthorAdapter = {
  type: "set_value", label: "set value", category: "values", description: "Replace an authored value.",
  create: () => ({ id: crypto.randomUUID(), type: "set_value", key: "", value: 0 }),
  references: (effect) => effect.type === "set_value" && effect.key ? [{ resourceKind: "value", resourceId: effect.key, detail: "value effect" }] : [],
  summarize: (effect, snapshot) => effect.type === "set_value" ? `${valueLabel(snapshot, effect.key)} = ${String(effect.value)}` : "Set value",
  render: ({ effect, onChange, snapshot }) => {
    if (effect.type !== "set_value") return null;
    const definition = snapshot.valueDefinitions.find((item) => item.key === effect.key);
    return <>
      <ReferenceField kind="value" value={effect.key} onChange={(key) => {
        const next = snapshot.valueDefinitions.find((item) => item.key === key);
        onChange({ ...effect, key, value: next?.initialValue ?? "" });
      }} />
      {definition?.valueType === "boolean"
        ? <select value={String(effect.value)} onChange={(event) => onChange({ ...effect, value: event.target.value === "true" })}><option value="true">true</option><option value="false">false</option></select>
        : <input type={definition?.valueType === "number" ? "number" : "text"} value={String(effect.value ?? "")} onChange={(event) => onChange({ ...effect, value: definition?.valueType === "number" ? Number(event.target.value) : event.target.value })} />}
    </>;
  },
};
export const incrementEffectAdapter: EffectAuthorAdapter = {
  type: "increment", label: "increase value", category: "values", description: "Increase an authored number value.",
  create: () => ({ id: crypto.randomUUID(), type: "increment", key: "", amount: 1 }),
  references: (effect) => effect.type === "increment" && effect.key ? [{ resourceKind: "number-value", resourceId: effect.key, detail: "value effect" }] : [],
  summarize: (effect, snapshot) => effect.type === "increment" ? `Increase ${valueLabel(snapshot, effect.key)} by ${effect.amount}` : "Increase value",
  render: ({ effect, onChange }) => effect.type === "increment" ? <><ReferenceField kind="number-value" value={effect.key} onChange={(key) => onChange({ ...effect, key })} /><input type="number" value={effect.amount} onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })} /></> : null,
};
export const decrementEffectAdapter: EffectAuthorAdapter = {
  type: "decrement", label: "decrease value", category: "values", description: "Decrease an authored number value.",
  create: () => ({ id: crypto.randomUUID(), type: "decrement", key: "", amount: 1 }),
  references: (effect) => effect.type === "decrement" && effect.key ? [{ resourceKind: "number-value", resourceId: effect.key, detail: "value effect" }] : [],
  summarize: (effect, snapshot) => effect.type === "decrement" ? `Decrease ${valueLabel(snapshot, effect.key)} by ${effect.amount}` : "Decrease value",
  render: ({ effect, onChange }) => effect.type === "decrement" ? <><ReferenceField kind="number-value" value={effect.key} onChange={(key) => onChange({ ...effect, key })} /><input type="number" value={effect.amount} onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })} /></> : null,
};
