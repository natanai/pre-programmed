import { useState } from "react";
import type {
  Condition,
  OperationHook,
  ProjectSnapshot,
} from "../../game/model";
import type { OperationId } from "../../features/operations/model";
import { ConditionEditor, EffectsEditor, ValueMentionField } from "../../components/AuthorFields";
import { AUTHOR_OPERATION_DEFINITIONS } from "./catalog";
import "./operationHooksEditor.css";

export type OperationCapabilityDraft = {
  interactable: boolean;
  operations: OperationId[];
  hooks: OperationHook[];
};

type HookScreen = "list" | "hook" | "when" | "effects";

function emptyHook(operation: OperationId, order: number): OperationHook {
  return {
    id: crypto.randomUUID(),
    operation,
    order,
    condition: { type: "always" },
    responseText: "",
    effects: [],
    success: false,
  };
}

function conditionSummary(condition: Condition): string {
  switch (condition.type) {
    case "always": return "Always";
    case "attempt": {
      if (condition.operator === "eq" && condition.value === 1) return "First attempt";
      if (condition.operator === "eq" && condition.value === 2) return "Second attempt";
      if (condition.operator === "gte" && condition.value === 2) return "Second attempt +";
      return `Attempt ${condition.operator} ${condition.value}`;
    }
    case "variable": return `${condition.key || "variable"} ${condition.operator} ${String(condition.value)}`;
    case "flag": return `${condition.key || "flag"} is ${condition.value ? "true" : "false"}`;
    case "has_item": return `Has item${condition.minimum && condition.minimum > 1 ? ` ×${condition.minimum}` : ""}`;
    case "lacks_item": return "Lacks item";
    case "visited": return condition.value ? "Visited node" : "Has not visited node";
    case "state": return `${condition.field} ${condition.operator} ${condition.value}`;
    case "all": return `All of ${condition.conditions.length} conditions`;
    case "any": return `Any of ${condition.conditions.length} conditions`;
    case "not": return `Not: ${conditionSummary(condition.condition)}`;
  }
}

function hookSnippet(hook: OperationHook) {
  const response = hook.responseText.trim().replace(/\s+/g, " ");
  if (response) return response.length > 64 ? `${response.slice(0, 61)}...` : response;
  if (hook.effects.length) return `${hook.effects.length} effect${hook.effects.length === 1 ? "" : "s"}, no response text`;
  return "No response yet";
}

function operationDefinitionsFor(current?: OperationId) {
  if (!current || AUTHOR_OPERATION_DEFINITIONS.some((definition) => definition.value === current)) {
    return AUTHOR_OPERATION_DEFINITIONS;
  }
  return [...AUTHOR_OPERATION_DEFINITIONS, { value: current, label: current }];
}

export function OperationHooksEditor({ capability, snapshot, onChange }: {
  capability: OperationCapabilityDraft;
  snapshot: ProjectSnapshot;
  onChange: (capability: OperationCapabilityDraft) => void;
}) {
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  const [screen, setScreen] = useState<HookScreen>("list");
  const selectedHook = selectedHookId ? capability.hooks.find((hook) => hook.id === selectedHookId) : undefined;

  const replaceHook = (id: string, hook: OperationHook) => onChange({
    ...capability,
    hooks: capability.hooks.map((candidate) => candidate.id === id ? hook : candidate),
  });

  const setHookOperation = (id: string, operation: OperationId) => onChange({
    ...capability,
    operations: capability.operations.includes(operation)
      ? capability.operations
      : [...capability.operations, operation],
    hooks: capability.hooks.map((candidate) => candidate.id === id ? { ...candidate, operation } : candidate),
  });

  const moveHook = (id: string, direction: -1 | 1) => {
    const index = capability.hooks.findIndex((hook) => hook.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= capability.hooks.length) return;
    const hooks = [...capability.hooks];
    [hooks[index], hooks[target]] = [hooks[target], hooks[index]];
    onChange({ ...capability, hooks: hooks.map((hook, order) => ({ ...hook, order })) });
  };

  const addHook = () => {
    const operation = capability.operations[0] ?? AUTHOR_OPERATION_DEFINITIONS[0]?.value ?? "inspect";
    const hook = emptyHook(operation, capability.hooks.length);
    onChange({
      interactable: true,
      operations: capability.operations.includes(operation) ? capability.operations : [...capability.operations, operation],
      hooks: [...capability.hooks, hook],
    });
    setSelectedHookId(hook.id);
    setScreen("hook");
  };

  const openHook = (hook: OperationHook) => {
    setSelectedHookId(hook.id);
    setScreen("hook");
  };

  const back = () => {
    if (screen === "when" || screen === "effects") {
      setScreen("hook");
      return;
    }
    setSelectedHookId(null);
    setScreen("list");
  };

  const removeSelected = () => {
    if (!selectedHook) return;
    onChange({
      ...capability,
      hooks: capability.hooks
        .filter((candidate) => candidate.id !== selectedHook.id)
        .map((candidate, order) => ({ ...candidate, order })),
    });
    setSelectedHookId(null);
    setScreen("list");
  };

  return <details className="operation-capability-editor focused-operation-capability">
    <summary>[PLAYER OPERATIONS]</summary>
    <div className="operation-capability-body">
      {screen === "list" ? <>
        <label className="check-label"><input type="checkbox" checked={capability.interactable}
          onChange={(event) => onChange({ ...capability, interactable: event.target.checked })} /> allow attempts from inventory/status</label>
        {capability.interactable ? <>
          <fieldset className="operation-choices"><legend>AVAILABLE OPERATIONS</legend>
            {AUTHOR_OPERATION_DEFINITIONS.map((operation) => <label className="check-label" key={operation.value}><input type="checkbox"
              checked={capability.operations.includes(operation.value)}
              onChange={(event) => onChange({
                ...capability,
                operations: event.target.checked
                  ? [...capability.operations, operation.value]
                  : capability.operations.filter((candidate) => candidate !== operation.value),
              })} /> {operation.label}</label>)}
          </fieldset>
          <div className="operation-hook-list">
            {capability.hooks.map((hook, index) => <div className="operation-hook-summary" key={hook.id}>
              <button type="button" className="operation-hook-open" onClick={() => openHook(hook)}>
                <span className="operation-hook-title">{index + 1}. {hook.operation.toUpperCase()} · {hook.success ? "SUCCEEDS" : "DOES NOT SUCCEED"}</span>
                <span>{hookSnippet(hook)}</span>
                <small>{conditionSummary(hook.condition)} · {hook.effects.length} effect{hook.effects.length === 1 ? "" : "s"}</small>
              </button>
              <div className="operation-hook-order">
                <button type="button" aria-label={`Move hook ${index + 1} up`} onClick={() => moveHook(hook.id, -1)}>[↑]</button>
                <button type="button" aria-label={`Move hook ${index + 1} down`} onClick={() => moveHook(hook.id, 1)}>[↓]</button>
              </div>
            </div>)}
          </div>
          <button type="button" className="operation-add-hook" onClick={addHook}>[+ OPERATION RESPONSE]</button>
        </> : null}
      </> : selectedHook ? <>
        <button type="button" className="operation-hook-back" onClick={back}>[{screen === "hook" ? "← BACK TO RESPONSES" : "← BACK TO RESPONSE"}]</button>
        {screen === "hook" ? <HookWorkspace hook={selectedHook} snapshot={snapshot}
          onChange={(hook) => replaceHook(selectedHook.id, hook)}
          onOperationChange={(operation) => setHookOperation(selectedHook.id, operation)}
          onOpenWhen={() => setScreen("when")}
          onOpenEffects={() => setScreen("effects")}
          onRemove={removeSelected} /> : null}
        {screen === "when" ? <WhenWorkspace hook={selectedHook} snapshot={snapshot}
          onChange={(condition) => replaceHook(selectedHook.id, { ...selectedHook, condition })} /> : null}
        {screen === "effects" ? <EffectsWorkspace hook={selectedHook} snapshot={snapshot}
          onChange={(effects) => replaceHook(selectedHook.id, { ...selectedHook, effects })} /> : null}
      </> : null}
    </div>
  </details>;
}

function HookWorkspace({ hook, snapshot, onChange, onOperationChange, onOpenWhen, onOpenEffects, onRemove }: {
  hook: OperationHook;
  snapshot: ProjectSnapshot;
  onChange: (hook: OperationHook) => void;
  onOperationChange: (operation: OperationId) => void;
  onOpenWhen: () => void;
  onOpenEffects: () => void;
  onRemove: () => void;
}) {
  const operationDefinitions = operationDefinitionsFor(hook.operation);
  return <div className="operation-hook-workspace">
    <label>OPERATION <select value={hook.operation} onChange={(event) => onOperationChange(event.target.value)}>
      {operationDefinitions.map((operation) => <option value={operation.value} key={operation.value}>{operation.label}</option>)}
    </select></label>
    <label className="check-label"><input type="checkbox" checked={hook.success}
      onChange={(event) => onChange({ ...hook, success: event.target.checked })} /> operation succeeds</label>
    <label>RESPONSE TEXT <ValueMentionField snapshot={snapshot} multiline rows={3} value={hook.responseText}
      onValueChange={(responseText) => onChange({ ...hook, responseText })} /></label>
    <button type="button" className="operation-drill-row" onClick={onOpenWhen}>
      <span><strong>WHEN</strong><small>{conditionSummary(hook.condition)}</small></span><span aria-hidden="true">›</span>
    </button>
    <button type="button" className="operation-drill-row" onClick={onOpenEffects}>
      <span><strong>EFFECTS</strong><small>{hook.effects.length ? `${hook.effects.length} configured` : "None"}</small></span><span aria-hidden="true">›</span>
    </button>
    <button type="button" className="operation-remove-hook" onClick={onRemove}>[REMOVE RESPONSE]</button>
  </div>;
}

function WhenWorkspace({ hook, snapshot, onChange }: { hook: OperationHook; snapshot: ProjectSnapshot; onChange: (condition: Condition) => void }) {
  return <div className="operation-subworkspace">
    <h3>WHEN SHOULD THIS RESPONSE HAPPEN?</h3>
    <div className="attempt-presets">
      <button type="button" onClick={() => onChange({ type: "always" })}>[ALWAYS]</button>
      <button type="button" onClick={() => onChange({ type: "attempt", operator: "eq", value: 1 })}>[FIRST]</button>
      <button type="button" onClick={() => onChange({ type: "attempt", operator: "eq", value: 2 })}>[SECOND]</button>
      <button type="button" onClick={() => onChange({ type: "attempt", operator: "gte", value: 2 })}>[2+]</button>
    </div>
    <ConditionEditor condition={hook.condition} snapshot={snapshot} onChange={onChange} />
  </div>;
}

function EffectsWorkspace({ hook, snapshot, onChange }: { hook: OperationHook; snapshot: ProjectSnapshot; onChange: (effects: OperationHook["effects"]) => void }) {
  return <div className="operation-subworkspace">
    <h3>EFFECTS · RUN IN THIS ORDER</h3>
    <EffectsEditor effects={hook.effects} snapshot={snapshot} onChange={onChange} />
  </div>;
}
