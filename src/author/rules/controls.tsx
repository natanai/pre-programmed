import type { ComparisonOperator } from "../../engine/rules/model";

export function ComparisonSelect({ value, onChange }: {
  value: ComparisonOperator;
  onChange: (value: ComparisonOperator) => void;
}) {
  return <select aria-label="Comparison" value={value} onChange={(event) => onChange(event.target.value as ComparisonOperator)}>
    <option value="eq">=</option><option value="neq">≠</option><option value="gt">&gt;</option>
    <option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option>
  </select>;
}
