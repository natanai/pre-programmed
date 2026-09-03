import { useEffect, useMemo, useState } from "react";
import type { EffectEvent } from "../../../engine/rules/effectRuntime";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import type { OperationId, OperationTarget } from "../../operations/model";
import { executeOperation, formatOperationOutput } from "../../operations/runtime";
import { visibleStateGroups, type VisibleStateEntry } from "../playerPresentation";
import "./stateStatus.css";

function displayValue(value: unknown) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  if (typeof value === "boolean") return value ? "YES" : "NO";
  return value === null || value === undefined ? "—" : String(value);
}

function targetForEntry(entry: VisibleStateEntry): OperationTarget {
  return { kind: entry.kind, id: entry.definition.id };
}

export function StateStatus({
  snapshot,
  state,
  onState,
  onOutput,
  onEvents,
}: {
  snapshot: ProjectSnapshot;
  state: PlayState;
  onState: (state: PlayState) => void;
  onOutput: (text: string) => void;
  onEvents: (events: EffectEvent[]) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const groups = useMemo(() => visibleStateGroups(snapshot, state, now), [snapshot, state, now]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const selectedGroup = groups.find(({ group }) => group.id === selectedGroupId) ?? null;
  const selectedEntry = selectedGroup?.entries.find(({ definition }) => definition.id === selectedEntryId) ?? null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const operate = (entry: VisibleStateEntry, operation: OperationId) => {
    const execution = executeOperation(snapshot, state, { operation, target: targetForEntry(entry) });
    const output = formatOperationOutput(execution, state);
    onEvents(execution.events);
    if (output) onOutput(output);
    onState(execution.state);
  };

  if (!selectedGroup) return <div className="state-status-surface">
    <div className="state-status-group-list">
      {groups.map(({ group, entries }) => <button
        type="button"
        className="state-status-group-row"
        key={group.id}
        onClick={() => {
          setSelectedEntryId(null);
          setSelectedGroupId(group.id);
        }}
      >
        <span>{group.label}</span>
        <small>{entries.length} ›</small>
      </button>)}
      {!groups.length ? <p className="state-status-empty">No information is currently visible.</p> : null}
    </div>
  </div>;

  return <div className="state-status-surface">
    <div className="state-status-toolbar">
      <button type="button" onClick={() => {
        setSelectedEntryId(null);
        setSelectedGroupId(null);
      }}>[← GROUPS]</button>
      <strong>{selectedGroup.group.label}</strong>
    </div>

    {selectedEntry ? <div className="state-status-inspector">
      <div className="state-status-inspector-heading">
        <strong>{selectedEntry.definition.label}</strong>
        <button type="button" onClick={() => setSelectedEntryId(null)}>[DONE]</button>
      </div>
      <div className="state-status-inspector-value">{displayValue(selectedEntry.value)}</div>
      {(selectedEntry.definition.operations ?? []).length ? <div className="operation-buttons">
        {(selectedEntry.definition.operations ?? []).map((operation) => <button
          type="button"
          key={operation}
          onClick={() => operate(selectedEntry, operation)}
        >[{operation.toUpperCase()}]</button>)}
      </div> : null}
    </div> : null}

    <div className="state-status-entry-list">
      {selectedGroup.entries.map((entry) => {
        const interactable = entry.definition.interactable && (entry.definition.operations ?? []).length > 0;
        const content = <><span>{entry.definition.label}</span><strong>{displayValue(entry.value)}</strong></>;
        return interactable ? <button
          type="button"
          className="state-status-entry-row"
          aria-pressed={selectedEntryId === entry.definition.id}
          key={`${entry.kind}:${entry.definition.id}`}
          onClick={() => setSelectedEntryId(entry.definition.id)}
        >{content}</button> : <div className="state-status-entry-row" key={`${entry.kind}:${entry.definition.id}`}>{content}</div>;
      })}
    </div>
  </div>;
}
