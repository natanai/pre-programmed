import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuthorLongPress } from "../ui/useAuthorLongPress";
import { useAuthorResourceTools } from "./context";
import "./referenceField.css";

export function ReferenceField({
  kind,
  value,
  onChange,
  placeholder,
  allowEmpty = true,
  showPreview = false,
}: {
  kind: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  showPreview?: boolean;
}) {
  const resources = useAuthorResourceTools();
  const chooserId = useId();
  const onChangeRef = useRef(onChange);
  const returnHighlightTimerRef = useRef<number | null>(null);
  onChangeRef.current = onChange;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [returned, setReturned] = useState(false);
  const options = resources.options(kind);
  const label = resources.label(kind);
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => options.filter((option) => !normalizedQuery
    || `${option.label} ${option.detail ?? ""} ${option.value}`.toLocaleLowerCase().includes(normalizedQuery)), [normalizedQuery, options]);
  const selectedLabel = selected?.label ?? (value ? `Missing: ${value}` : (placeholder ?? `Choose ${label.toLowerCase()}`));
  const preview = showPreview && selected ? resources.preview(kind, value) : null;
  const canEditSelected = Boolean(selected && resources.canEdit(kind, value));
  const canCreate = resources.canCreate(kind);

  useEffect(() => () => {
    if (returnHighlightTimerRef.current !== null) window.clearTimeout(returnHighlightTimerRef.current);
  }, []);

  const markReturned = () => {
    setReturned(true);
    if (returnHighlightTimerRef.current !== null) window.clearTimeout(returnHighlightTimerRef.current);
    returnHighlightTimerRef.current = window.setTimeout(() => {
      returnHighlightTimerRef.current = null;
      setReturned(false);
    }, 1100);
  };
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
    resources.create(kind, (resource) => {
      onChangeRef.current(resource.value);
      markReturned();
    });
  };
  const editResource = () => {
    if (!canEditSelected) return;
    closeChooser();
    resources.edit(kind, value, (result) => {
      if (!result) return;
      if (result.type === "resource" && result.kind === kind) onChangeRef.current(result.value);
      markReturned();
    });
  };
  const longPressEdit = useAuthorLongPress({
    enabled: canEditSelected,
    onLongPress: editResource,
  });
  const openOrCreate = () => {
    if (open) {
      closeChooser();
      return;
    }
    if (!value && !options.length && canCreate) {
      createResource();
      return;
    }
    setOpen(true);
  };

  return <div className={`author-reference-field${open ? " is-open" : ""}${returned ? " is-returned" : ""}`} data-resource-kind={kind}>
    <div className="author-reference-control-row">
      <button
        type="button"
        className="author-reference-trigger"
        aria-expanded={open}
        aria-controls={chooserId}
        onClick={openOrCreate}
        {...longPressEdit}
      >
        <span className="author-reference-kind">{label.toUpperCase()}</span>
        <span className={`author-reference-value${selected ? "" : " is-empty"}`}>{selectedLabel}</span>
        <span className="author-reference-chevron" aria-hidden="true">{open ? "⌄" : "›"}</span>
      </button>
      {canEditSelected ? <button
        type="button"
        className="author-reference-direct-action"
        aria-label={`Edit ${selected?.label ?? label}`}
        onClick={editResource}
      >[EDIT]</button> : !selected && canCreate ? <button
        type="button"
        className="author-reference-direct-action"
        aria-label={`Create ${label}`}
        onClick={createResource}
      >[+ CREATE]</button> : null}
    </div>

    {preview ? <div className="author-reference-preview">{preview}</div> : null}

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
        {canCreate ? <button type="button" onClick={createResource}>[+ CREATE {label.toUpperCase()}]</button> : null}
        <button type="button" onClick={closeChooser}>[CLOSE]</button>
      </div>
    </section> : null}
  </div>;
}
