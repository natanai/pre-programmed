import { normalizeAuthorKey } from "./generatedKey";
import "./generatedKeyField.css";

export function GeneratedKeyField({ source, value, onChange }: {
  source: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const generated = normalizeAuthorKey(source) || "generated-on-save";
  return <details className="author-identifier-details">
    <summary>[ADVANCED IDENTIFIER]</summary>
    <label>KEY
      <input
        value={value}
        placeholder={generated}
        onChange={(event) => onChange(normalizeAuthorKey(event.target.value))}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <small>{value ? "Stable internal key. Change only when you intentionally need a different identifier." : `Generated automatically from the name/label: ${generated}`}</small>
    </label>
  </details>;
}
