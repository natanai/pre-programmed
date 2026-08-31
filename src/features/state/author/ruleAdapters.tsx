import type { Value } from "../../../game/model";
import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../../../author/rules/types";
import { ComparisonSelect, DefinitionSelect } from "../../../author/rules/controls";

function parseValue(value: string, sample: Value): Value {
  if (typeof sample === "number") return Number(value);
  if (typeof sample === "boolean") return value === "true";
  return value;
}

export const flagConditionAdapter: ConditionAuthorAdapter = {
  type: "flag",
  label: "flag",
  create: () => ({ type: "flag", key: "", value: true }),
  render: ({ condition, onChange, snapshot }) => {
    if (condition.type !== "flag") return null;
    return <>
      <select value={condition.key} onChange={(event) => onChange({ ...condition, key: event.target.value })}>
        <option value="">choose flag</option>
        {snapshot.variables.filter((item) => item.valueType === "boolean").map((item) => <option value={item.key} key={item.id}>{item.label}</option>)}
      </select>
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
      <select value={condition.key} onChange={(event) => {
        const definition = snapshot.variables.find((item) => item.key === event.target.value);
        onChange({ ...condition, key: event.target.value, value: definition?.initialValue ?? 0 });
      }}>
        <option value="">choose value</option>
        {snapshot.variables.map((item) => <option value={item.key} key={item.id}>{item.label}</option>)}
      </select>
      <ComparisonSelect value={condition.operator} onChange={(operator) => onChange({ ...condition, operator })} />
      <input aria-label="Comparison value" value={String(condition.value ?? "")} onChange={(event) => onChange({ ...condition, value: parseValue(event.target.value, condition.value) })} />
    </>;
  },
};

export const setFlagEffectAdapter: EffectAuthorAdapter = {
  type: "set_flag",
  label: "set flag",
  create: () => ({ id: crypto.randomUUID(), type: "set_flag", key: "" }),
  render: ({ effect, onChange, snapshot }) => effect.type === "set_flag"
    ? <DefinitionSelect value={effect.key} definitions={snapshot.variables.filter((item) => item.valueType === "boolean")} onChange={(key) => onChange({ ...effect, key })} />
    : null,
};

export const clearFlagEffectAdapter: EffectAuthorAdapter = {
  type: "clear_flag",
  label: "clear flag",
  create: () => ({ id: crypto.randomUUID(), type: "clear_flag", key: "" }),
  render: ({ effect, onChange, snapshot }) => effect.type === "clear_flag"
    ? <DefinitionSelect value={effect.key} definitions={snapshot.variables.filter((item) => item.valueType === "boolean")} onChange={(key) => onChange({ ...effect, key })} />
    : null,
};

export const setValueEffectAdapter: EffectAuthorAdapter = {
  type: "set_value",
  label: "set value",
  create: () => ({ id: crypto.randomUUID(), type: "set_value", key: "", value: 0 }),
  render: ({ effect, onChange, snapshot }) => {
    if (effect.type !== "set_value") return null;
    const definition = snapshot.variables.find((item) => item.key === effect.key);
    return <>
      <DefinitionSelect value={effect.key} definitions={snapshot.variables} onChange={(key) => {
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
  create: () => ({ id: crypto.randomUUID(), type: "increment", key: "", amount: 1 }),
  render: ({ effect, onChange, snapshot }) => effect.type === "increment" ? <>
    <DefinitionSelect value={effect.key} definitions={snapshot.variables.filter((item) => item.valueType === "number")} onChange={(key) => onChange({ ...effect, key })} />
    <input type="number" value={effect.amount} onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })} />
  </> : null,
};

export const decrementEffectAdapter: EffectAuthorAdapter = {
  type: "decrement",
  label: "decrement",
  create: () => ({ id: crypto.randomUUID(), type: "decrement", key: "", amount: 1 }),
  render: ({ effect, onChange, snapshot }) => effect.type === "decrement" ? <>
    <DefinitionSelect value={effect.key} definitions={snapshot.variables.filter((item) => item.valueType === "number")} onChange={(key) => onChange({ ...effect, key })} />
    <input type="number" value={effect.amount} onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })} />
  </> : null,
};
