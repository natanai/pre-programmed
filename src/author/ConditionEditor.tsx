import type { ChangeEvent } from "react";
import type { Condition, ProjectSnapshot } from "../game/model";
import { CONDITION_AUTHOR_ADAPTERS, CONDITION_AUTHOR_ADAPTER_BY_TYPE } from "./rules/catalog";

export function ConditionEditor({
  condition,
  onChange,
  snapshot,
  depth = 0,
}: {
  condition: Condition;
  onChange: (condition: Condition) => void;
  snapshot: ProjectSnapshot;
  depth?: number;
}) {
  const adapter = CONDITION_AUTHOR_ADAPTER_BY_TYPE[condition.type];
  const selectType = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = CONDITION_AUTHOR_ADAPTER_BY_TYPE[event.target.value as Condition["type"]];
    if (next) onChange(next.create());
  };

  return <div className={`condition-editor condition-depth-${Math.min(depth, 3)}`}>
    <select aria-label="Condition type" value={condition.type} onChange={selectType}>
      {CONDITION_AUTHOR_ADAPTERS.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}
    </select>
    {adapter?.render({
      condition,
      snapshot,
      onChange,
      depth,
      renderNested: (child, onChildChange) => <ConditionEditor condition={child} snapshot={snapshot} depth={depth + 1} onChange={onChildChange} />,
    })}
  </div>;
}
