import { useMemo, useState } from "react";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import { statusEntryValue, visibleStatusGroups } from "../runtime";
import "./status.css";

function displayValue(value: unknown) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  if (typeof value === "boolean") return value ? "YES" : "NO";
  return value === null || value === undefined ? "—" : String(value);
}

export function Status({ snapshot, state }: { snapshot: ProjectSnapshot; state: PlayState }) {
  const groups = useMemo(() => visibleStatusGroups(snapshot, state), [snapshot, state]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const selected = groups.find((item) => item.group.id === selectedGroupId) ?? null;

  return <div className="status-player-surface">
    {selected ? <button type="button" className="status-back" onClick={() => setSelectedGroupId(null)}>[← GROUPS]</button> : null}
    {!selected ? <div className="status-group-list">
      {groups.map(({ group, entries }) => <button
        type="button"
        className="status-group-row"
        key={group.id}
        onClick={() => setSelectedGroupId(group.id)}
      ><span>{group.label}</span><small>{entries.length} ›</small></button>)}
      {!groups.length ? <p className="status-empty">No status information is currently visible.</p> : null}
    </div> : <div className="status-entry-list">
      {selected.entries.map((entry) => <div className="status-entry-row" key={entry.id}>
        <span>{entry.label || (entry.source.kind === "value"
          ? snapshot.valueDefinitions.find((candidate) => candidate.id === entry.source.id)?.label
          : snapshot.derivedValueDefinitions.find((candidate) => candidate.id === entry.source.id)?.label) || "Value"}</span>
        <strong>{displayValue(statusEntryValue(entry, snapshot, state))}</strong>
      </div>)}
    </div>}
  </div>;
}
