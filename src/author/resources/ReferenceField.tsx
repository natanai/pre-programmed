import { useRef } from "react";
import { useAuthorResourceTools } from "./context";
import "./referenceField.css";

export function ReferenceField({
  kind,
  value,
  onChange,
  placeholder,
  allowEmpty = true,
}: {
  kind: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const resources = useAuthorResourceTools();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const options = resources.options(kind);
  const label = resources.label(kind);
  const selected = options.find((option) => option.value === value);

  return <div className="author-reference-field" data-resource-kind={kind}>
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowEmpty ? <option value="">{placeholder ?? `choose ${label.toLowerCase()}`}</option> : null}
      {options.map((option) => <option value={option.value} key={option.id}>{option.label}</option>)}
    </select>
    <div className="author-reference-actions">
      {selected && resources.canEdit(kind, value) ? <button
        type="button"
        className="author-reference-edit"
        onClick={() => resources.edit(kind, value)}
      >[EDIT]</button> : null}
      {resources.canCreate(kind) ? <button
        type="button"
        className="author-reference-create"
        onClick={() => resources.create(kind, (resource) => onChangeRef.current(resource.value))}
      >[+ {label.toUpperCase()}]</button> : null}
    </div>
    {!options.length && resources.canCreate(kind) ? <small className="author-reference-empty">No {label.toLowerCase()} exists yet. Create one without leaving this task.</small> : null}
  </div>;
}
