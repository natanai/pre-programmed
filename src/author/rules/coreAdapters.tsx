import type { ConditionAuthorAdapter } from "./types";
import { ComparisonSelect } from "./controls";

export const alwaysConditionAdapter: ConditionAuthorAdapter = {
  type: "always",
  label: "always",
  create: () => ({ type: "always" }),
  render: () => null,
};

export const allConditionAdapter: ConditionAuthorAdapter = {
  type: "all",
  label: "all (AND)",
  create: () => ({ type: "all", conditions: [{ type: "always" }] }),
  render: ({ condition, onChange, renderNested }) => {
    if (condition.type !== "all") return null;
    return <div className="condition-children">
      {condition.conditions.map((child, index) => <div className="condition-child" key={index}>
        {renderNested(child, (next) => onChange({ ...condition, conditions: condition.conditions.map((value, childIndex) => childIndex === index ? next : value) }))}
        <button type="button" onClick={() => onChange({ ...condition, conditions: condition.conditions.filter((_, childIndex) => childIndex !== index) })}>[-]</button>
      </div>)}
      <button type="button" onClick={() => onChange({ ...condition, conditions: [...condition.conditions, { type: "always" }] })}>[+ CONDITION]</button>
    </div>;
  },
};

export const anyConditionAdapter: ConditionAuthorAdapter = {
  type: "any",
  label: "any (OR)",
  create: () => ({ type: "any", conditions: [{ type: "always" }] }),
  render: ({ condition, onChange, renderNested }) => {
    if (condition.type !== "any") return null;
    return <div className="condition-children">
      {condition.conditions.map((child, index) => <div className="condition-child" key={index}>
        {renderNested(child, (next) => onChange({ ...condition, conditions: condition.conditions.map((value, childIndex) => childIndex === index ? next : value) }))}
        <button type="button" onClick={() => onChange({ ...condition, conditions: condition.conditions.filter((_, childIndex) => childIndex !== index) })}>[-]</button>
      </div>)}
      <button type="button" onClick={() => onChange({ ...condition, conditions: [...condition.conditions, { type: "always" }] })}>[+ CONDITION]</button>
    </div>;
  },
};

export const notConditionAdapter: ConditionAuthorAdapter = {
  type: "not",
  label: "not",
  create: () => ({ type: "not", condition: { type: "always" } }),
  render: ({ condition, onChange, renderNested }) => {
    if (condition.type !== "not") return null;
    return <>{renderNested(condition.condition, (next) => onChange({ ...condition, condition: next }))}</>;
  },
};

export const attemptConditionAdapter: ConditionAuthorAdapter = {
  type: "attempt",
  label: "attempt count",
  create: () => ({ type: "attempt", operator: "eq", value: 1 }),
  render: ({ condition, onChange }) => {
    if (condition.type !== "attempt") return null;
    return <>
      <ComparisonSelect value={condition.operator} onChange={(operator) => onChange({ ...condition, operator })} />
      <input aria-label="Attempt number" type="number" min={0} value={condition.value} onChange={(event) => onChange({ ...condition, value: Number(event.target.value) })} />
      <small>Uses this interaction or operation automatically.</small>
    </>;
  },
};

export const runtimeStateConditionAdapter: ConditionAuthorAdapter = {
  type: "state",
  label: "state field",
  create: () => ({ type: "state", field: "currentNodeId", operator: "eq", value: "" }),
  render: ({ condition, onChange }) => {
    if (condition.type !== "state") return null;
    return <>
      <select value={condition.field} onChange={(event) => onChange({ ...condition, field: event.target.value as "currentNodeId" | "lastCommand" })}>
        <option value="currentNodeId">current node</option><option value="lastCommand">last command</option>
      </select>
      <select value={condition.operator} onChange={(event) => onChange({ ...condition, operator: event.target.value as "eq" | "neq" })}>
        <option value="eq">equals</option><option value="neq">does not equal</option>
      </select>
      <input value={condition.value} onChange={(event) => onChange({ ...condition, value: event.target.value })} />
    </>;
  },
};
