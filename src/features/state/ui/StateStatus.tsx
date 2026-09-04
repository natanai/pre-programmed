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
  initialGroupId,
  onState,
  onOutput,
  onEvents,
  onEditGroup,
  onEditEntry,
}: {
  snapshot: ProjectSnapshot;
  state: PlayState;
  initialGroupId?: string;
  onState: (state: PlayState) => void;
  onOutput: (text: string) => void;
  onEvents: (events: EffectEvent[]) => void;
  onEditGroup?: (groupId: string) => void;
  onEditEntry?: (entry: VisibleStateEntry) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const groups = useMemo(() => visibleStateGroups(snapshot, state, now), [snapshot, state, now]);
  const hasElapsedTime = groups.some(({ entries }) => entries.some((entry) =>
    entry.kind === "computed" && entry.definition.source === "elapsed_seconds"));
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId ?? null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const selectedGroup = groups.find(({ group }) => group.id === selectedGroupId) ?? null;
  const selectedEntry = selectedGroup?.entries.find(({ definition }) => definition.id === selectedEntryId) ?? null;

  useEffect(() => {
    if (!hasElapsedTime) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasElapsedTime]);

  const operate = (entry: VisibleStateEntry, operation: OperationId) => {
    const execution = executeOperation(snapshot, state, { operation, target: targetForEntry(entry) });
    const output = formatOperationOutput(execution, state);
    onEvents(execution.events);
    if (output) onOutput(output);
    onState(execution.state);
  };

  if (!selectedGroup) return <div className="state-status-surface">
    <div className="state-status-group-list">
      {groups.map(({ group, entries }) => {
        const content = <><span>{group.label}</span><small>{entries.length} ›</small></>;
        if (onEditGroup) return <div className="state-status-group-row is-authoring" key={group.id}>
          <button
            type="button"
            className="state-status-group-main"
            onClick={() => {
              setSelectedEntryId(null);
              setSelectedGroupId(group.id);
            }}
          >{content}</button>
          <button type="button" className="state-status-group-edit" onClick={() => onEditGroup(group.id)}>[EDIT]</button>
        </div>;
        return <button
          type="button"
          className="state-status-group-row"
          key={group.id}
          onClick={() => {
            setSelectedEntryId(null);
            setSelectedGroupId(group.id);
          }}
        >{content}</button>;
      })}
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
      {onEditGroup ? <button type="button" onClick={() => onEditGroup(selectedGroup.group.id)}>[EDIT GROUP]</button> : null}
    </div>

    {selectedEntry ? <div className="state-status-inspector">
      <div className="state-status-inspector-heading">
        <strong>{selectedEntry.definition.label}</strong>
        <div className="state-status-inspector-actions">
          {onEditEntry ? <button type="button" onClick={() => onEditEntry(selectedEntry)}>[EDIT]</button> : null}
          <button type="button" onClick={() => setSelectedEntryId(null)}>[DONE]</button>
        </div>
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
        if (onEditEntry) return <div className="state-status-entry-row is-authoring" key={`${entry.kind}:${entry.definition.id}`}>
          {interactable ? <button
            type="button"
            className="state-status-entry-main"
            aria-pressed={selectedEntryId === entry.definition.id}
            onClick={() => setSelectedEntryId(entry.definition.id)}
          >{content}</button> : <div className="state-status-entry-main">{content}</div>}
          <button type="button" className="state-status-entry-edit" onClick={() => onEditEntry(entry)}>[EDIT]</button>
        </div>;
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
