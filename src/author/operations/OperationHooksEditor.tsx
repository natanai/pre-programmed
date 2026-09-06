import { useEffect, useRef, useState } from "react";
import type {
  Condition,
} from "../../engine/rules/model";
import type { ProjectSnapshot } from "../../engine/project/model";
import type { OperationHook, OperationId } from "../../features/operations/model";
import {
  OutcomeComposerSection,
  OutcomeConditionEditor,
  OutcomeEffectsEditor,
} from "../outcomes/OutcomeComposer";
import { ValueMentionField } from "../ValueMentionField";
import { authorOperationDefinitions } from "./catalog";
import "./operationHooksEditor.css";

export type OperationCapabilityDraft = {
  interactable: boolean;
  operations: OperationId[];
  hooks: OperationHook[];
};

type HookScreen = "list" | "hook";

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

/** Mirrors the runtime's order + id tie-break. An earlier Always response is terminal for this operation. */
function hookIsShadowed(hook: OperationHook, hooks: readonly OperationHook[]) {
  return hooks.some((candidate) => candidate.id !== hook.id
    && candidate.operation === hook.operation
    && candidate.condition.type === "always"
    && (candidate.order < hook.order || (candidate.order === hook.order && candidate.id.localeCompare(hook.id) < 0)));
}

function operationDefinitionsFor(snapshot: ProjectSnapshot, targetKind: string, current?: OperationId) {
  const definitions = authorOperationDefinitions(snapshot, targetKind);
  if (!current || definitions.some((definition) => definition.value === current)) return definitions;
  return [...definitions, { value: current, label: current, targetKinds: [targetKind] }];
}

/**
 * Operation behavior body. The parent Author workspace owns disclosure/navigation
 * so implementation composition never adds a second visual layer.
 */
export function OperationHooksEditor({ capability, snapshot, targetKind, defaultOpen = false, preferredOperation, onChange }: {
  capability: OperationCapabilityDraft;
  snapshot: ProjectSnapshot;
  /** Semantic author target kind, e.g. inventory.item or world.character. */
  targetKind: string;
  /** Retained for route compatibility; when paired with a preferred operation it enables focus landing. */
  defaultOpen?: boolean;
  preferredOperation?: string;
  onChange: (capability: OperationCapabilityDraft) => void;
}) {
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  const [screen, setScreen] = useState<HookScreen>("list");
  const preferredControlRef = useRef<HTMLButtonElement>(null);
  const selectedHook = selectedHookId ? capability.hooks.find((hook) => hook.id === selectedHookId) : undefined;
  const operationDefinitions = authorOperationDefinitions(snapshot, targetKind);
  const cardDefinitions = [
    ...operationDefinitions,
    ...capability.hooks
      .filter((hook) => !operationDefinitions.some((definition) => definition.value === hook.operation))
      .map((hook) => ({ value: hook.operation, label: hook.operation, targetKinds: [targetKind] })),
  ].filter((definition, index, all) => all.findIndex((candidate) => candidate.value === definition.value) === index)
    .sort((left, right) => left.value === preferredOperation ? -1 : right.value === preferredOperation ? 1 : 0);

  useEffect(() => {
    if (!defaultOpen || !preferredOperation) return;
    const frame = window.requestAnimationFrame(() => {
      const control = preferredControlRef.current;
      if (!control) return;
      control.scrollIntoView({ block: "center", inline: "nearest" });
      control.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [defaultOpen, preferredOperation]);

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
    const hook = capability.hooks.find((candidate) => candidate.id === id);
    if (!hook) return;
    const siblings = capability.hooks.filter((candidate) => candidate.operation === hook.operation);
    const siblingIndex = siblings.findIndex((candidate) => candidate.id === id);
    const siblingTarget = siblings[siblingIndex + direction];
    if (!siblingTarget) return;
    const index = capability.hooks.findIndex((candidate) => candidate.id === id);
    const target = capability.hooks.findIndex((candidate) => candidate.id === siblingTarget.id);
    const hooks = [...capability.hooks];
    [hooks[index], hooks[target]] = [hooks[target], hooks[index]];
    onChange({ ...capability, hooks: hooks.map((candidate, order) => ({ ...candidate, order })) });
  };

  const addHook = (operation: OperationId) => {
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

  return <div className="operation-capability-editor focused-operation-capability">
    <div className="operation-capability-body">
      {screen === "list" ? <>
        <label className="check-label"><input type="checkbox" checked={capability.interactable}
          onChange={(event) => onChange({ ...capability, interactable: event.target.checked })} /> player can attempt operations on this target</label>
        {capability.interactable ? <>
          <p className="operation-capability-help">An available operation can use feature defaults even without an authored response. Add responses when this target should say something, apply effects, vary by attempt, or override success.</p>
          <div className="operation-card-list">
            {cardDefinitions.map((operation) => {
              const available = capability.operations.includes(operation.value);
              const hooks = capability.hooks.filter((hook) => hook.operation === operation.value);
              const preferred = operation.value === preferredOperation;
              return <section className={`operation-card${available ? " is-available" : ""}`} key={operation.value} data-preferred-operation={preferred || undefined}>
                <div className="operation-card-heading">
                  <span><strong>{operation.label.toUpperCase()}</strong><small>{available ? "AVAILABLE TO PLAYER" : "NOT AVAILABLE"} · {hooks.length} response{hooks.length === 1 ? "" : "s"}</small></span>
                  <label className="check-label"><input type="checkbox" checked={available} onChange={(event) => onChange({
                    ...capability,
                    operations: event.target.checked
                      ? [...capability.operations, operation.value]
                      : capability.operations.filter((candidate) => candidate !== operation.value),
                  })} /> available</label>
                </div>
                {hooks.length ? <div className="operation-hook-list">
                  {hooks.map((hook, index) => {
                    const shadowed = hookIsShadowed(hook, hooks);
                    return <div className={`operation-hook-summary${shadowed ? " is-shadowed" : ""}`} key={hook.id}>
                      <button type="button" className="operation-hook-open" onClick={() => openHook(hook)}>
                        <span className="operation-hook-title">{index + 1}. {hook.success ? "SUCCEEDS" : "DOES NOT SUCCEED"}</span>
                        <span>{hookSnippet(hook)}</span>
                        <small>{conditionSummary(hook.condition)} · {hook.effects.length} effect{hook.effects.length === 1 ? "" : "s"}</small>
                        {shadowed ? <small className="operation-hook-shadow-warning">UNREACHABLE · an earlier ALWAYS response handles this operation first</small> : null}
                      </button>
                      <div className="operation-hook-order">
                        <button type="button" aria-label={`Move ${operation.label} response ${index + 1} up`} disabled={index === 0} onClick={() => moveHook(hook.id, -1)}>[↑]</button>
                        <button type="button" aria-label={`Move ${operation.label} response ${index + 1} down`} disabled={index === hooks.length - 1} onClick={() => moveHook(hook.id, 1)}>[↓]</button>
                      </div>
                    </div>;
                  })}
                </div> : <span className="operation-card-empty">No authored response. {available ? "Feature defaults may still handle this operation." : "Enable it or add a response when needed."}</span>}
                <button
                  ref={preferred ? preferredControlRef : undefined}
                  type="button"
                  className="operation-add-hook"
                  onClick={() => addHook(operation.value)}
                >[+ {operation.label.toUpperCase()} RESPONSE]</button>
              </section>;
            })}
            {!cardDefinitions.length ? <div className="operation-card-empty">No operation vocabulary is installed for this target yet. Create targeted wording in Player Interactions to add one.</div> : null}
          </div>
        </> : null}
      </> : selectedHook ? <>
        <button type="button" className="operation-hook-back" onClick={back}>[← BACK TO RESPONSES]</button>
        {screen === "hook" ? <HookWorkspace hook={selectedHook} snapshot={snapshot} targetKind={targetKind}
          shadowed={hookIsShadowed(selectedHook, capability.hooks)}
          onChange={(hook) => replaceHook(selectedHook.id, hook)}
          onOperationChange={(operation) => setHookOperation(selectedHook.id, operation)}
          onRemove={removeSelected} /> : null}
      </> : null}
    </div>
  </div>;
}

function HookWorkspace({ hook, snapshot, targetKind, shadowed, onChange, onOperationChange, onRemove }: {
  hook: OperationHook;
  snapshot: ProjectSnapshot;
  targetKind: string;
  shadowed: boolean;
  onChange: (hook: OperationHook) => void;
  onOperationChange: (operation: OperationId) => void;
  onRemove: () => void;
}) {
  const operationDefinitions = operationDefinitionsFor(snapshot, targetKind, hook.operation);
  return <div className="operation-hook-workspace">
    {shadowed ? <div className="operation-hook-shadow-warning" role="alert">UNREACHABLE: an earlier ALWAYS response for this operation runs first. Move this response above it or give the earlier response a condition.</div> : null}
    <label>OPERATION <select value={hook.operation} onChange={(event) => onOperationChange(event.target.value)}>
      {operationDefinitions.map((operation) => <option value={operation.value} key={operation.value}>{operation.label}</option>)}
    </select></label>
    <label className="check-label"><input type="checkbox" checked={hook.success}
      onChange={(event) => onChange({ ...hook, success: event.target.checked })} /> operation succeeds</label>
    <label>RESPONSE TEXT <ValueMentionField snapshot={snapshot} multiline rows={3} value={hook.responseText}
      onValueChange={(responseText) => onChange({ ...hook, responseText })} /></label>
    <div className="operation-outcome-composer" aria-label="Response conditions and effects">
      <OutcomeComposerSection title="WHEN" summary={conditionSummary(hook.condition)}>
        <OutcomeConditionEditor
          condition={hook.condition}
          snapshot={snapshot}
          language="attempt"
          onChange={(condition) => onChange({ ...hook, condition })}
        />
      </OutcomeComposerSection>
      <OutcomeComposerSection title="EFFECTS" summary={hook.effects.length ? `${hook.effects.length} configured` : "None"}>
        <OutcomeEffectsEditor
          effects={hook.effects}
          snapshot={snapshot}
          targetKind={targetKind}
          onChange={(effects) => onChange({ ...hook, effects })}
        />
      </OutcomeComposerSection>
    </div>
    <button type="button" className="operation-remove-hook" onClick={onRemove}>[REMOVE RESPONSE]</button>
  </div>;
}
