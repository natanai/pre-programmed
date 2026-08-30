import type {
  InventoryOperation,
  OperationHook,
  ProjectSnapshot,
} from "../game/model";
import { ConditionEditor, EffectsEditor, ValueTokenBar } from "./AuthorFields";

export type OperationCapabilityDraft = {
  interactable: boolean;
  operations: InventoryOperation[];
  hooks: OperationHook[];
};

const OPERATIONS: Array<{ value: InventoryOperation; label: string }> = [
  { value: "inspect", label: "inspect" },
  { value: "use", label: "use" },
  { value: "move", label: "move" },
  { value: "remove", label: "remove" },
];

function emptyHook(operation: InventoryOperation, order: number): OperationHook {
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

export function OperationHooksEditor({ capability, snapshot, onChange }: {
  capability: OperationCapabilityDraft;
  snapshot: ProjectSnapshot;
  onChange: (capability: OperationCapabilityDraft) => void;
}) {
  const replaceHook = (id: string, hook: OperationHook) => onChange({
    ...capability,
    hooks: capability.hooks.map((candidate) => candidate.id === id ? hook : candidate),
  });
  const moveHook = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= capability.hooks.length) return;
    const hooks = [...capability.hooks];
    [hooks[index], hooks[target]] = [hooks[target], hooks[index]];
    onChange({ ...capability, hooks: hooks.map((hook, order) => ({ ...hook, order })) });
  };
  const addHook = () => {
    const operation = capability.operations[0] ?? "inspect";
    onChange({
      interactable: true,
      operations: capability.operations.includes(operation) ? capability.operations : [...capability.operations, operation],
      hooks: [...capability.hooks, emptyHook(operation, capability.hooks.length)],
    });
  };

  return <details className="operation-capability-editor">
    <summary>[PLAYER OPERATIONS]</summary>
    <label className="check-label"><input type="checkbox" checked={capability.interactable}
      onChange={(event) => onChange({ ...capability, interactable: event.target.checked })} /> allow attempts from inventory/status</label>
    {capability.interactable ? <>
      <fieldset className="operation-choices"><legend>AVAILABLE OPERATIONS</legend>
        {OPERATIONS.map((operation) => <label className="check-label" key={operation.value}><input type="checkbox"
          checked={capability.operations.includes(operation.value)}
          onChange={(event) => onChange({
            ...capability,
            operations: event.target.checked
              ? [...capability.operations, operation.value]
              : capability.operations.filter((candidate) => candidate !== operation.value),
          })} /> {operation.label}</label>)}
      </fieldset>
      {capability.hooks.map((hook, index) => <fieldset className="operation-hook" key={hook.id}>
        <legend>HOOK {index + 1}</legend>
        <div className="hook-head"><select value={hook.operation} onChange={(event) => {
          const operation = event.target.value as InventoryOperation;
          onChange({
            ...capability,
            operations: capability.operations.includes(operation) ? capability.operations : [...capability.operations, operation],
            hooks: capability.hooks.map((candidate) => candidate.id === hook.id ? { ...hook, operation } : candidate),
          });
        }}>{OPERATIONS.map((operation) => <option value={operation.value} key={operation.value}>{operation.label} attempt</option>)}</select>
          <label className="check-label"><input type="checkbox" checked={hook.success}
            onChange={(event) => replaceHook(hook.id, { ...hook, success: event.target.checked })} /> succeeds</label>
          <button type="button" onClick={() => moveHook(index, -1)}>[↑]</button>
          <button type="button" onClick={() => moveHook(index, 1)}>[↓]</button>
          <button type="button" onClick={() => onChange({ ...capability, hooks: capability.hooks.filter((candidate) => candidate.id !== hook.id).map((candidate, order) => ({ ...candidate, order })) })}>[REMOVE]</button>
        </div>
        <div className="attempt-presets"><span>WHEN:</span>
          <button type="button" onClick={() => replaceHook(hook.id, { ...hook, condition: { type: "attempt", operator: "eq", value: 1 } })}>[FIRST]</button>
          <button type="button" onClick={() => replaceHook(hook.id, { ...hook, condition: { type: "attempt", operator: "eq", value: 2 } })}>[SECOND]</button>
          <button type="button" onClick={() => replaceHook(hook.id, { ...hook, condition: { type: "attempt", operator: "gte", value: 2 } })}>[2+]</button>
        </div>
        <ConditionEditor condition={hook.condition} snapshot={snapshot}
          onChange={(condition) => replaceHook(hook.id, { ...hook, condition })} />
        <label>RESPONSE-TEXT <textarea rows={2} value={hook.responseText}
          onChange={(event) => replaceHook(hook.id, { ...hook, responseText: event.target.value })} /></label>
        <ValueTokenBar snapshot={snapshot}
          onInsert={(token) => replaceHook(hook.id, { ...hook, responseText: hook.responseText + token })} />
        <EffectsEditor effects={hook.effects} snapshot={snapshot}
          onChange={(effects) => replaceHook(hook.id, { ...hook, effects })} />
      </fieldset>)}
      <button type="button" onClick={addHook}>[+ OPERATION HOOK]</button>
    </> : null}
  </details>;
}
