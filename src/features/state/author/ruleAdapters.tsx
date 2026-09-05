import type { Value } from "../../../engine/rules/model";
import { isRuntimeBinding, PLAYER_INPUT_BINDING, runtimeBinding } from "../../../engine/rules/runtimeBindings";
import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../../../author/rules/types";
import { ComparisonSelect } from "../../../author/rules/controls";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { FlagScope } from "../ruleTypes";

function parseValue(value: string, sample: Value): Value {
  if (typeof sample === "number") return Number(value);
  if (typeof sample === "boolean") return value === "true";
  return value;
}

function variableLabel(snapshot: Parameters<NonNullable<EffectAuthorAdapter["summarize"]>>[1], key: string) {
  return snapshot.variables.find((item) => item.key === key)?.label || key || "choose value";
}

function flagScope(scope: FlagScope | undefined): FlagScope {
  return scope === "node" ? "node" : "global";
}

function scopedFlagLabel(
  snapshot: Parameters<NonNullable<EffectAuthorAdapter["summarize"]>>[1],
  key: string,
  scope: FlagScope | undefined,
) {
  return flagScope(scope) === "node" ? `local ${key || "flag"}` : variableLabel(snapshot, key);
}

function flagScopeControl(
  scope: FlagScope | undefined,
  onChange: (scope: FlagScope) => void,
) {
  return <label>SCOPE
    <select value={flagScope(scope)} onChange={(event) => onChange(event.target.value as FlagScope)}>
      <option value="global">project / global</option>
      <option value="node">current node only</option>
    </select>
  </label>;
}

function localFlagKeyField(key: string, onChange: (key: string) => void) {
  return <>
    <label>LOCAL FLAG
      <input
        value={key}
        placeholder="lookedaround"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
    <small>Private to this Node in the current run. The same name can be reused independently in other Nodes.</small>
  </>;
}

export const flagConditionAdapter: ConditionAuthorAdapter = {
  type: "flag",
  label: "flag",
  create: () => ({ type: "flag", key: "", value: true, scope: "global" }),
  references: (condition) => condition.type === "flag" && condition.key && flagScope(condition.scope) === "global"
    ? [{ resourceKind: "flag", resourceId: condition.key, detail: "flag condition" }]
    : [],
  render: ({ condition, onChange }) => {
    if (condition.type !== "flag") return null;
    const scope = flagScope(condition.scope);
    return <>
      {flagScopeControl(scope, (nextScope) => onChange({ ...condition, scope: nextScope, key: "" }))}
      {scope === "node"
        ? localFlagKeyField(condition.key, (key) => onChange({ ...condition, key }))
        : <ReferenceField kind="flag" value={condition.key} onChange={(key) => onChange({ ...condition, key })} />}
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
  references: (condition) => condition.type === "variable" && condition.key ? [{ resourceKind: "variable", resourceId: condition.key, detail: "variable condition" }] : [],
  render: ({ condition, onChange, snapshot }) => {
    if (condition.type !== "variable") return null;
    const definition = snapshot.variables.find((item) => item.key === condition.key);
    const sample = definition?.initialValue ?? condition.value;
    return <>
      <ReferenceField kind="variable" value={condition.key} onChange={(key) => {
        const next = snapshot.variables.find((item) => item.key === key);
        onChange({ ...condition, key, value: next?.initialValue ?? 0 });
      }} />
      <ComparisonSelect value={condition.operator} onChange={(operator) => onChange({ ...condition, operator })} />
      <input
        aria-label="Comparison value"
        type={definition?.valueType === "number" || typeof sample === "number" ? "number" : "text"}
        value={String(condition.value ?? "")}
        onChange={(event) => onChange({ ...condition, value: parseValue(event.target.value, sample) })}
      />
    </>;
  },
};

export const setFlagEffectAdapter: EffectAuthorAdapter = {
  type: "set_flag",
  label: "set flag",
  category: "state",
  description: "Turn a project or Node-local boolean flag on.",
  create: () => ({ id: crypto.randomUUID(), type: "set_flag", key: "", scope: "global" }),
  references: (effect) => effect.type === "set_flag" && effect.key && flagScope(effect.scope) === "global"
    ? [{ resourceKind: "flag", resourceId: effect.key, detail: "flag effect" }]
    : [],
  summarize: (effect, snapshot) => effect.type === "set_flag"
    ? `Set ${scopedFlagLabel(snapshot, effect.key, effect.scope)} true`
    : "Set flag",
  render: ({ effect, onChange }) => {
    if (effect.type !== "set_flag") return null;
    const scope = flagScope(effect.scope);
    return <>
      {flagScopeControl(scope, (nextScope) => onChange({ ...effect, scope: nextScope, key: "" }))}
      {scope === "node"
        ? localFlagKeyField(effect.key, (key) => onChange({ ...effect, key }))
        : <ReferenceField kind="flag" value={effect.key} onChange={(key) => onChange({ ...effect, key })} />}
    </>;
  },
};

export const clearFlagEffectAdapter: EffectAuthorAdapter = {
  type: "clear_flag",
  label: "clear flag",
  category: "state",
  description: "Turn a project or Node-local boolean flag off.",
  create: () => ({ id: crypto.randomUUID(), type: "clear_flag", key: "", scope: "global" }),
  references: (effect) => effect.type === "clear_flag" && effect.key && flagScope(effect.scope) === "global"
    ? [{ resourceKind: "flag", resourceId: effect.key, detail: "flag effect" }]
    : [],
  summarize: (effect, snapshot) => effect.type === "clear_flag"
    ? `Set ${scopedFlagLabel(snapshot, effect.key, effect.scope)} false`
    : "Clear flag",
  render: ({ effect, onChange }) => {
    if (effect.type !== "clear_flag") return null;
    const scope = flagScope(effect.scope);
    return <>
      {flagScopeControl(scope, (nextScope) => onChange({ ...effect, scope: nextScope, key: "" }))}
      {scope === "node"
        ? localFlagKeyField(effect.key, (key) => onChange({ ...effect, key }))
        : <ReferenceField kind="flag" value={effect.key} onChange={(key) => onChange({ ...effect, key })} />}
    </>;
  },
};

export const setValueEffectAdapter: EffectAuthorAdapter = {
  type: "set_value",
  label: "set value",
  category: "state",
  description: "Replace an authored variable's value.",
  create: () => ({ id: crypto.randomUUID(), type: "set_value", key: "", value: 0 }),
  references: (effect) => effect.type === "set_value" && effect.key ? [{ resourceKind: "variable", resourceId: effect.key, detail: "variable effect" }] : [],
  summarize: (effect, snapshot) => {
    if (effect.type !== "set_value") return "Set value";
    const source = isRuntimeBinding(effect.value)
      ? effect.value.key === PLAYER_INPUT_BINDING ? "player input" : `runtime ${effect.value.key}`
      : String(effect.value);
    return `${variableLabel(snapshot, effect.key)} = ${source}`;
  },
  render: ({ effect, onChange, snapshot }) => {
    if (effect.type !== "set_value") return null;
    const definition = snapshot.variables.find((item) => item.key === effect.key);
    const binding = isRuntimeBinding(effect.value) ? effect.value : null;
    const sourceMode = binding?.key === PLAYER_INPUT_BINDING ? "player-input" : binding ? "runtime-binding" : "literal";
    const resetLiteral = definition?.initialValue ?? "";
    return <>
      <ReferenceField kind="variable" value={effect.key} onChange={(key) => {
        const next = snapshot.variables.find((item) => item.key === key);
        onChange({ ...effect, key, value: binding ?? next?.initialValue ?? "" });
      }} />
      <label>VALUE FROM
        <select value={sourceMode} onChange={(event) => {
          const mode = event.target.value;
          if (mode === "player-input") onChange({ ...effect, value: runtimeBinding(PLAYER_INPUT_BINDING) });
          else if (mode === "runtime-binding") onChange({ ...effect, value: runtimeBinding(binding?.key ?? "") });
          else onChange({ ...effect, value: resetLiteral });
        }}>
          <option value="literal">authored value</option>
          <option value="player-input">player input</option>
          {sourceMode === "runtime-binding" ? <option value="runtime-binding">runtime binding</option> : null}
        </select>
      </label>
      {sourceMode === "runtime-binding" ? <label>RUNTIME BINDING
        <input value={binding?.key ?? ""} onChange={(event) => onChange({ ...effect, value: runtimeBinding(event.target.value) })} />
      </label> : null}
      {sourceMode === "player-input" ? <small>The submitted player text is converted to this variable's type when the effect runs.</small> : null}
      {sourceMode === "literal" ? definition?.valueType === "boolean"
        ? <select value={String(effect.value)} onChange={(event) => onChange({ ...effect, value: event.target.value === "true" })}><option value="true">true</option><option value="false">false</option></select>
        : <input type={definition?.valueType === "number" ? "number" : "text"} value={String(effect.value ?? "")} onChange={(event) => onChange({ ...effect, value: definition?.valueType === "number" ? Number(event.target.value) : event.target.value })} /> : null}
    </>;
  },
};

export const incrementEffectAdapter: EffectAuthorAdapter = {
  type: "increment",
  label: "increment",
  category: "state",
  description: "Increase an authored number variable.",
  create: () => ({ id: crypto.randomUUID(), type: "increment", key: "", amount: 1 }),
  references: (effect) => effect.type === "increment" && effect.key ? [{ resourceKind: "number-variable", resourceId: effect.key, detail: "variable effect" }] : [],
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
  references: (effect) => effect.type === "decrement" && effect.key ? [{ resourceKind: "number-variable", resourceId: effect.key, detail: "variable effect" }] : [],
  summarize: (effect, snapshot) => effect.type === "decrement" ? `Decrease ${variableLabel(snapshot, effect.key)} by ${effect.amount}` : "Decrement",
  render: ({ effect, onChange }) => effect.type === "decrement" ? <>
    <ReferenceField kind="number-variable" value={effect.key} onChange={(key) => onChange({ ...effect, key })} />
    <input type="number" value={effect.amount} onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })} />
  </> : null,
};