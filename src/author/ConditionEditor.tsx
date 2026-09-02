import type { ChangeEvent } from "react";
import type { Condition } from "../engine/rules/model";
import type { ProjectSnapshot } from "../engine/project/model";
import { conditionAuthorAdapter, conditionAuthorAdapters } from "./rules/catalog";

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
  const adapters = conditionAuthorAdapters();
  const adapter = conditionAuthorAdapter(condition.type);
  const selectType = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = conditionAuthorAdapter(event.target.value as Condition["type"]);
    if (next) onChange(next.create());
  };

  return <div className={`condition-editor condition-depth-${Math.min(depth, 3)}`}>
    <select aria-label="Condition type" value={condition.type} onChange={selectType}>
      {adapters.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}
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
