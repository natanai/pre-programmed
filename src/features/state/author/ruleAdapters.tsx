import type { Value } from "../../../game/model";
import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../../../author/rules/types";
import { ComparisonSelect } from "../../../author/rules/controls";
import { ReferenceField } from "../../../author/resources/ReferenceField";

function parseValue(value: string, sample: Value): Value {
  if (typeof sample === "number") return Number(value);
  if (typeof sample === "boolean") return value === "true";
  return value;
}

function variableLabel(snapshot: Parameters<NonNullable<EffectAuthorAdapter["summarize"]>>[1], key: string) {
  return snapshot.variables.find((item) => item.key === key)?.label || key || "choose value";
}

export const flagConditionAdapter: ConditionAuthorAdapter = {
  type: "flag",
  label: "flag",
  create: () => ({ type: "flag", key: "", value: true }),
  render: ({ condition, onChange }) => {
    if (condition.type !== "flag") return null;
    return <>
      <ReferenceField kind="flag" value={condition.key} onChange={(key) => onChange({ ...condition, key })} />
      <select value={String(condition.value)} onChange={(event) => onChange({ ...condition, value: event.target.value === "true" })}>
        <option value="true">is true</option><option value="false">is false</option>
      </select>
    </>;
  },
};

export const variableConditionAdapter: ConditionAuthorAdapter = {
  type: "variable",
  label: "variable comparison",
  create: () => ({ type: "variable", key: "", operator: "eq", value: 0 }),
  render: ({ condition, onChange, snapshot }) => {
    if (condition.type !== "variable") return null;
    return <>
      <ReferenceField kind="variable" value={condition.key} onChange={(key) => {
        const definition = snapshot.variables.find((item) => item.key === key);
        onChange({ ...condition, key, value: definition?.initialValue ?? 0 });
      }} />
      <ComparisonSelect value={condition.operator} onChange={(operator) => onChange({ ...condition, operator })} />
      <input aria-label="Comparison value" value={String(condition.value ?? "")} onChange={(event) => onChange({ ...condition, value: parseValue(event.target.value, condition.value) })} />
    </>;
  },
};

export const setFlagEffectAdapter: EffectAuthorAdapter = {
  type: "set_flag",
  label: "set flag",
  category: "state",
  description: "Turn an authored boolean flag on.",
  create: () => ({ id: crypto.randomUUID(), type: "set_flag", key: "" }),
  summarize: (effect, snapshot) => effect.type === "set_flag" ? `Set ${variableLabel(snapshot, effect.key)} true` : "Set flag",
  render: ({ effect, onChange }) => effect.type === "set_flag"
    ? <ReferenceField kind="flag" value={effect.key} onChange={(key) => onChange({ ...effect, key })} />
    : null,
};

export const clearFlagEffectAdapter: EffectAuthorAdapter = {
  type: "clear_flag",
  label: "clear flag",
  category: "state",
  description: "Turn an authored boolean flag off.",
  create: () => ({ id: crypto.randomUUID(), type: "clear_flag", key: "" }),
  summarize: (effect, snapshot) => effect.type === "clear_flag" ? `Set ${variableLabel(snapshot, effect.key)} false` : "Clear flag",
  render: ({ effect, onChange }) => effect.type === "clear_flag"
    ? <ReferenceField kind="flag" value={effect.key} onChange={(key) => onChange({ ...effect, key })} />
    : null,
};

export const setValueEffectAdapter: EffectAuthorAdapter = {
  type: "set_value",
  label: "set value",
  category: "state",
  description: "Replace an authored variable's value.",
  create: () => ({ id: crypto.randomUUID(), type: "set_value", key: "", value: 0 }),
  summarize: (effect, snapshot) => effect.type === "set_value" ? `${variableLabel(snapshot, effect.key)} = ${String(effect.value)}` : "Set value",
  render: ({ effect, onChange, snapshot }) => {
    if (effect.type !== "set_value") return null;
    const definition = snapshot.variables.find((item) => item.key === effect.key);
    return <>
      <ReferenceField kind="variable" value={effect.key} onChange={(key) => {
        const next = snapshot.variables.find((item) => item.key === key);
        onChange({ ...effect, key, value: next?.initialValue ?? "" });
      }} />
      {definition?.valueType === "boolean"
        ? <select value={String(effect.value)} onChange={(event) => onChange({ ...effect, value: event.target.value === "true" })}><option value="true">true</option><option value="false">false</option></select>
        : <input type={definition?.valueType === "number" ? "number" : "text"} value={String(effect.value ?? "")} onChange={(event) => onChange({ ...effect, value: definition?.valueType === "number" ? Number(event.target.value) : event.target.value })} />}
    </>;
  },
};

export const incrementEffectAdapter: EffectAuthorAdapter = {
  type: "increment",
  label: "increment",
  category: "state",
  description: "Increase an authored number variable.",
  create: () => ({ id: crypto.randomUUID(), type: "increment", key: "", amount: 1 }),
  summarize: (effect, snapshot) => effect.type === "increment" ? `Increase ${variableLabel(snapshot, effect.key)} by ${effect.amount}` : "Increment",
  render: ({ effect, onChange }) => effect.type === "increment" ? <>
    <ReferenceField kind="number-variable" value={effect.key} onChange={(key) => onChange({ ...effect, key })} />
    <input type="number" value={effect.amount} onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })} />
  </> : null,
};

export const decrementEffectAdapter: EffectAuthorAdapter = {
  type: "decrement",
  label: "decrement",
  category: "state",
  description: "Decrease an authored number variable.",
  create: () => ({ id: crypto.randomUUID(), type: "decrement", key: "", amount: 1 }),
  summarize: (effect, snapshot) => effect.type === "decrement" ? `Decrease ${variableLabel(snapshot, effect.key)} by ${effect.amount}` : "Decrement",
  render: ({ effect, onChange }) => effect.type === "decrement" ? <>
    <ReferenceField kind="number-variable" value={effect.key} onChange={(key) => onChange({ ...effect, key })} />
    <input type="number" value={effect.amount} onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })} />
  </> : null,
};
