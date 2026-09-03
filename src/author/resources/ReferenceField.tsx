import { useId, useMemo, useRef, useState } from "react";
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
  const chooserId = useId();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = resources.options(kind);
  const label = resources.label(kind);
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => options.filter((option) => !normalizedQuery
    || `${option.label} ${option.detail ?? ""} ${option.value}`.toLocaleLowerCase().includes(normalizedQuery)), [normalizedQuery, options]);
  const selectedLabel = selected?.label ?? (value ? `Missing: ${value}` : (placeholder ?? `Choose ${label.toLowerCase()}`));

  const closeChooser = () => {
    setOpen(false);
    setQuery("");
  };
  const choose = (nextValue: string) => {
    onChangeRef.current(nextValue);
    closeChooser();
  };
  const createResource = () => {
    closeChooser();
    resources.create(kind, (resource) => onChangeRef.current(resource.value));
  };
  const editResource = () => {
    closeChooser();
    resources.edit(kind, value, (result) => {
      if (result?.type === "resource" && result.kind === kind) onChangeRef.current(result.value);
    });
  };
  const openOrCreate = () => {
    if (open) {
      closeChooser();
      return;
    }
    if (!value && !options.length && resources.canCreate(kind)) {
      createResource();
      return;
    }
    setOpen(true);
  };

  return <div className={`author-reference-field${open ? " is-open" : ""}`} data-resource-kind={kind}>
    <button
      type="button"
      className="author-reference-trigger"
      aria-expanded={open}
      aria-controls={chooserId}
      onClick={openOrCreate}
    >
      <span className="author-reference-kind">{label.toUpperCase()}</span>
      <span className={`author-reference-value${selected ? "" : " is-empty"}`}>{selectedLabel}</span>
      <span className="author-reference-chevron" aria-hidden="true">{open ? "⌄" : "›"}</span>
    </button>

    {open ? <section id={chooserId} className="author-reference-chooser" aria-label={`Choose ${label}`}>
      <header>CHOOSE {label.toUpperCase()}</header>
      {options.length ? <label className="author-reference-search">
        <span>FIND</span>
        <input
          type="search"
          value={query}
          placeholder={label.toLowerCase()}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label> : null}
      <div className="author-reference-options" role="listbox" aria-label={`${label} options`}>
        {allowEmpty ? <button
          type="button"
          role="option"
          aria-selected={!value}
          onClick={() => choose("")}
        ><span>{placeholder ?? "NONE / CLEAR"}</span></button> : null}
        {filtered.map((option) => <button
          type="button"
          role="option"
          aria-selected={option.value === value}
          key={option.id}
          onClick={() => choose(option.value)}
        >
          <span>{option.label}</span>
          {option.detail ? <small>{option.detail}</small> : null}
        </button>)}
        {options.length && !filtered.length ? <span className="author-reference-no-results">NO MATCH</span> : null}
        {!options.length ? <span className="author-reference-no-results">NO {label.toUpperCase()}S YET</span> : null}
      </div>
      <div className="author-reference-actions">
        {selected && resources.canEdit(kind, value) ? <button type="button" onClick={editResource}>[EDIT {label.toUpperCase()}]</button> : null}
        {resources.canCreate(kind) ? <button type="button" onClick={createResource}>[+ CREATE {label.toUpperCase()}]</button> : null}
        <button type="button" onClick={closeChooser}>[CLOSE]</button>
      </div>
      {resources.canCreate(kind) ? <small className="author-reference-return-help">Creating opens a nested Author task. Save there to return here with the new {label.toLowerCase()} selected.</small> : null}
    </section> : null}
    {!options.length && resources.canCreate(kind) && !open ? <small className="author-reference-empty">No {label.toLowerCase()} exists yet. Create one here.</small> : null}
  </div>;
}
