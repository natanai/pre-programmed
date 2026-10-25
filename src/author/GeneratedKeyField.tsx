import { normalizeAuthorKey } from "./generatedKey";
import { AuthorHelp } from "./ui/AuthorHelp";
import "./generatedKeyField.css";

export function GeneratedKeyField({ source, value, onChange }: {
  source: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const generated = normalizeAuthorKey(source) || "generated-on-save";
  return <details className="author-identifier-details">
    <summary>[ADVANCED IDENTIFIER]</summary>
    <div className="author-ui-field"><div className="author-ui-field-heading"><label htmlFor="author-generated-key">KEY</label><AuthorHelp label="About internal keys" text={value ? "The key is a stable identifier. Change it only when you intentionally need a different identity." : `The key is generated automatically from the name: ${generated}`} /></div>
      <input id="author-generated-key"
        value={value}
        placeholder={generated}
        onChange={(event) => onChange(normalizeAuthorKey(event.target.value))}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  </details>;
}
