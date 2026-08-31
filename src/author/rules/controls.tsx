import type { ComparisonOperator } from "../../game/model";

export function ComparisonSelect({ value, onChange }: {
  value: ComparisonOperator;
  onChange: (value: ComparisonOperator) => void;
}) {
  return <select aria-label="Comparison" value={value} onChange={(event) => onChange(event.target.value as ComparisonOperator)}>
    <option value="eq">=</option><option value="neq">≠</option><option value="gt">&gt;</option>
    <option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option>
  </select>;
}

export function DefinitionSelect({ value, definitions, valueMode = "key", onChange }: {
  value: string;
  definitions: Array<{ id: string; key?: string; label?: string; name?: string; wording?: string }>;
  valueMode?: "key" | "id";
  onChange: (value: string) => void;
}) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">choose</option>
    {definitions.map((item) => <option key={item.id} value={valueMode === "id" ? item.id : (item.key ?? item.id)}>{item.label ?? item.name ?? item.wording ?? item.key ?? item.id}</option>)}
  </select>;
}
