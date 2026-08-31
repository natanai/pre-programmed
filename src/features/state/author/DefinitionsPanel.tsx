import { useState } from "react";
import { useDraftDirty } from "../../../author/useDraftDirty";
import type {
  ComputedDefinition,
  EntityDefinition,
  MutationOperation,
  ProjectSnapshot,
  VariableDefinition,
  Value,
} from "../../../game/model";
import { OperationHooksEditor } from "../../../components/OperationHooksEditor";
import "./definitionsPanel.css";

type Mode = "variables" | "computed" | "entities";

type ActiveDefinition = VariableDefinition | ComputedDefinition | EntityDefinition | null;

export function DefinitionsPanel({ snapshot, onSave, onDirtyChange, requestDiscard }: {
  snapshot: ProjectSnapshot;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  requestDiscard?: (discard: () => void) => void;
}) {
  const [mode, setMode] = useState<Mode>("variables");
  const [variable, setVariable] = useState<VariableDefinition | null>(null);
  const [computed, setComputed] = useState<ComputedDefinition | null>(null);
  const [entity, setEntity] = useState<EntityDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(variable || computed || entity);
  const selectedId = variable?.id ?? computed?.id ?? entity?.id;
  const activeDraft: ActiveDefinition = variable ?? computed ?? entity;
  const { markSaved, resetBaseline } = useDraftDirty(activeDraft, onDirtyChange);
  const request = requestDiscard ?? ((discard: () => void) => discard());

  const clearEditor = () => {
    resetBaseline(null);
    setVariable(null);
    setComputed(null);
    setEntity(null);
  };

  const openVariable = (item: VariableDefinition) => request(() => {
    const next: VariableDefinition = {
      ...structuredClone(item),
      interactable: item.interactable ?? false,
      operations: item.operations ?? [],
      hooks: item.hooks ?? [],
      timeRate: item.timeRate ?? 0,
      timeUnit: item.timeUnit ?? "second",
    };
    resetBaseline(next);
    setComputed(null);
    setEntity(null);
    setMode("variables");
    setVariable(next);
  });

  const openComputed = (item: ComputedDefinition) => request(() => {
    const next: ComputedDefinition = {
      ...structuredClone(item),
      interactable: item.interactable ?? false,
      operations: item.operations ?? [],
      hooks: item.hooks ?? [],
    };
    resetBaseline(next);
    setVariable(null);
    setEntity(null);
    setMode("computed");
    setComputed(next);
  });

  const openEntity = (item: EntityDefinition) => request(() => {
    const next = structuredClone(item);
    resetBaseline(next);
    setVariable(null);
    setComputed(null);
    setMode("entities");
    setEntity(next);
  });

  const saveVariable = async () => {
    if (!variable?.key.trim() || !variable.label.trim()) return;
    setSaving(true);
    try {
      await onSave([{ type: "variable.upsert", definition: variable }], `Changed variable ${variable.label}`);
      markSaved();
    } finally { setSaving(false); }
  };

  const saveComputed = async () => {
    if (!computed?.key.trim() || !computed.label.trim()) return;
    setSaving(true);
    try {
      await onSave([{ type: "computed.upsert", definition: computed }], `Changed computed value ${computed.label}`);
      markSaved();
    } finally { setSaving(false); }
  };

  const saveEntity = async () => {
    if (!entity?.key.trim() || !entity.name.trim()) return;
    setSaving(true);
    try {
      await onSave([{ type: "entity.upsert", entity }], `Changed ${entity.type} ${entity.name}`);
      markSaved();
    } finally { setSaving(false); }
  };

  const title = variable
    ? `VARIABLE · ${variable.label || variable.key || "NEW"}`
    : computed
      ? `COMPUTED · ${computed.label || computed.key || "NEW"}`
      : entity
        ? `${entity.type.toUpperCase()} · ${entity.name || entity.key || "NEW"}`
        : "STATE + PEOPLE";

  const backLabel = mode === "variables" ? "VARIABLES" : mode === "computed" ? "COMPUTED" : "PEOPLE + PLACES";
  const leaveDetail = () => request(clearEditor);

  return <section className="author-panel author-panel-frame definitions-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header>
      <span>{title}</span>
      {editing ? <span className="definition-header-context">STATE + PEOPLE</span> : null}
    </header>
    <div className={`author-panel-body definitions-panel-body${editing ? " is-editing" : ""}`}>
      <div className="definitions-master-pane">
        <DefinitionIndex
          snapshot={snapshot}
          mode={mode}
          selectedId={selectedId}
          onMode={(nextMode) => request(() => { setMode(nextMode); clearEditor(); })}
          onVariable={openVariable}
          onComputed={openComputed}
          onEntity={openEntity}
          onNewVariable={() => openVariable({ id: crypto.randomUUID(), key: "", label: "", valueType: "number", initialValue: 0, showInStatus: false, interactable: false, operations: [], hooks: [], timeRate: 0, timeUnit: "second" })}
          onNewComputed={() => openComputed({ id: crypto.randomUUID(), key: "", label: "", source: "elapsed_seconds", format: "integer", showInStatus: false, interactable: false, operations: [], hooks: [] })}
          onNewEntity={(type) => openEntity({ id: crypto.randomUUID(), key: "", type, name: "", description: "", tags: [] })}
        />
      </div>
      {editing ? <div className="definitions-detail-pane">
        <button type="button" className="definition-back" onClick={leaveDetail}>[← {backLabel}]</button>
        <div className="definition-detail-scroll">
          {variable ? <VariableEditor variable={variable} snapshot={snapshot} onChange={setVariable} /> : null}
          {computed ? <ComputedEditor computed={computed} snapshot={snapshot} onChange={setComputed} /> : null}
          {entity ? <EntityEditor entity={entity} onChange={setEntity} /> : null}
        </div>
        {variable ? <EditorFooter saving={saving} onSave={() => void saveVariable()} onCancel={leaveDetail} /> : null}
        {computed ? <EditorFooter saving={saving} onSave={() => void saveComputed()} onCancel={leaveDetail} /> : null}
        {entity ? <EditorFooter saving={saving} onSave={() => void saveEntity()} onCancel={leaveDetail} /> : null}
      </div> : null}
    </div>
  </section>;
}

function DefinitionIndex({ snapshot, mode, selectedId, onMode, onVariable, onComputed, onEntity, onNewVariable, onNewComputed, onNewEntity }: {
  snapshot: ProjectSnapshot;
  mode: Mode;
  selectedId?: string;
  onMode: (mode: Mode) => void;
  onVariable: (item: VariableDefinition) => void;
  onComputed: (item: ComputedDefinition) => void;
  onEntity: (item: EntityDefinition) => void;
  onNewVariable: () => void;
  onNewComputed: () => void;
  onNewEntity: (type: EntityDefinition["type"]) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (...values: Array<string | number | undefined>) => !normalizedQuery || values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
  const variables = snapshot.variables.filter((item) => matches(item.label, item.key, item.valueType, item.timeUnit, item.timeRate));
  const computedValues = snapshot.computedValues.filter((item) => matches(item.label, item.key, item.source, item.format));
  const characters = snapshot.entities.filter((item) => item.type === "character" && matches(item.name, item.key, item.description, item.tags.join(" ")));
  const locations = snapshot.entities.filter((item) => item.type === "location" && matches(item.name, item.key, item.description, item.tags.join(" ")));
  const resultCount = mode === "variables" ? variables.length : mode === "computed" ? computedValues.length : characters.length + locations.length;
  const totalCount = mode === "variables" ? snapshot.variables.length : mode === "computed" ? snapshot.computedValues.length : snapshot.entities.length;
  const switchMode = (nextMode: Mode) => {
    setQuery("");
    onMode(nextMode);
  };

  return <>
    <div className="definition-master-controls">
      <nav className="panel-tabs definition-tabs" aria-label="State and people categories">
        <button type="button" aria-pressed={mode === "variables"} onClick={() => switchMode("variables")}>VARIABLES</button>
        <button type="button" aria-pressed={mode === "computed"} onClick={() => switchMode("computed")}>COMPUTED</button>
        <button type="button" aria-pressed={mode === "entities"} onClick={() => switchMode("entities")}>PEOPLE + PLACES</button>
      </nav>
      <div className="definition-search-row">
        <label htmlFor="definition-search">FIND</label>
        <div className="definition-search-control">
          <input
            id="definition-search"
            type="search"
            value={query}
            placeholder={mode === "variables" ? "variable name or key" : mode === "computed" ? "computed value or source" : "person, place, key, or tag"}
            onChange={(event) => setQuery(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <span className="definition-result-count" aria-live="polite">{normalizedQuery ? `${resultCount}/${totalCount}` : totalCount}</span>
          {query ? <button type="button" className="definition-search-clear" aria-label="Clear search" onClick={() => setQuery("")}>[X]</button> : null}
        </div>
      </div>
    </div>

    <div className="definition-index-scroll">
      {mode === "variables" ? <section className="definition-index-section">
        {variables.length ? <div className="definition-list">{variables.map((item) => <DefinitionRow
          key={item.id}
          title={item.label || item.key || "Untitled variable"}
          detail={`${item.key} · ${item.valueType}${item.valueType === "number" && item.timeRate ? ` · ${item.timeRate > 0 ? "+" : ""}${item.timeRate}/${item.timeUnit ?? "second"}` : ""}`}
          selected={selectedId === item.id}
          onOpen={() => onVariable(item)}
        />)}</div> : <div className="definition-empty">{normalizedQuery ? "NO MATCHING VARIABLES." : "NO VARIABLES YET."}</div>}
      </section> : null}

      {mode === "computed" ? <section className="definition-index-section">
        {computedValues.length ? <div className="definition-list">{computedValues.map((item) => <DefinitionRow
          key={item.id}
          title={item.label || item.key || "Untitled computed value"}
          detail={`${item.key} · ${item.source}`}
          selected={selectedId === item.id}
          onOpen={() => onComputed(item)}
        />)}</div> : <div className="definition-empty">{normalizedQuery ? "NO MATCHING COMPUTED VALUES." : "NO COMPUTED VALUES YET."}</div>}
      </section> : null}

      {mode === "entities" ? <section className="definition-index-section entity-index">
        <DefinitionKind title="CHARACTERS" items={characters} onOpen={onEntity} selectedId={selectedId} empty={normalizedQuery ? "No matching characters." : "No characters yet."} />
        <DefinitionKind title="LOCATIONS" items={locations} onOpen={onEntity} selectedId={selectedId} empty={normalizedQuery ? "No matching locations." : "No locations yet."} />
      </section> : null}
    </div>

    <div className="definition-index-actions">
      {mode === "variables" ? <button type="button" onClick={onNewVariable}>[+ VARIABLE]</button> : null}
      {mode === "computed" ? <button type="button" onClick={onNewComputed}>[+ COMPUTED VALUE]</button> : null}
      {mode === "entities" ? <><button type="button" onClick={() => onNewEntity("character")}>[+ CHARACTER]</button><button type="button" onClick={() => onNewEntity("location")}>[+ LOCATION]</button></> : null}
    </div>
  </>;
}

function DefinitionRow({ title, detail, selected, onOpen }: { title: string; detail: string; selected: boolean; onOpen: () => void }) {
  return <button type="button" className="definition-row" aria-current={selected ? "true" : undefined} onClick={onOpen}>
    <span className="definition-row-copy"><strong>{title}</strong><small>{detail}</small></span>
    <span className="definition-row-arrow" aria-hidden="true">›</span>
  </button>;
}

function DefinitionKind({ title, items, onOpen, selectedId, empty }: { title: string; items: EntityDefinition[]; onOpen: (item: EntityDefinition) => void; selectedId?: string; empty: string }) {
  return <section className="definition-kind-group">
    <h3>{title}</h3>
    {items.length ? <div className="definition-list">{items.map((item) => <DefinitionRow key={item.id} title={item.name || item.key || `Untitled ${item.type}`} detail={item.key} selected={selectedId === item.id} onOpen={() => onOpen(item)} />)}</div> : <div className="definition-empty">{empty}</div>}
  </section>;
}

function VariableEditor({ variable, snapshot, onChange }: { variable: VariableDefinition; snapshot: ProjectSnapshot; onChange: (value: VariableDefinition) => void }) {
  return <div className="definition-form focused-definition-form">
    <label>KEY <input value={variable.key} onChange={(event) => onChange({ ...variable, key: normalizeKey(event.target.value) })} /></label>
    <label>LABEL <input value={variable.label} onChange={(event) => onChange({ ...variable, label: event.target.value })} /></label>
    <label>TYPE <select value={variable.valueType} onChange={(event) => {
      const valueType = event.target.value as VariableDefinition["valueType"];
      onChange({ ...variable, valueType, initialValue: valueType === "number" ? 0 : valueType === "boolean" ? false : "", timeRate: valueType === "number" ? variable.timeRate ?? 0 : 0 });
    }}><option value="number">number</option><option value="boolean">boolean / flag</option><option value="string">text / enum</option></select></label>
    <label>INITIAL VALUE <InitialValueInput definition={variable} onChange={(initialValue) => onChange({ ...variable, initialValue })} /></label>
    {variable.valueType === "number" ? <div className="time-change-setting">
      <label>CHANGE OVER TIME (+/-) <input aria-label="Change over time amount" type="number" step="any" value={variable.timeRate ?? 0} onChange={(event) => onChange({ ...variable, timeRate: Number(event.target.value) })} /></label>
      <label>PER <select aria-label="Time change unit" value={variable.timeUnit ?? "second"} onChange={(event) => onChange({ ...variable, timeUnit: event.target.value as "second" | "minute" | "hour" })}><option value="second">second</option><option value="minute">minute</option><option value="hour">hour</option></select></label>
    </div> : null}
    <label className="check-label"><input type="checkbox" checked={variable.showInStatus} onChange={(event) => onChange({ ...variable, showInStatus: event.target.checked })} /> show in inventory/status</label>
    {variable.showInStatus ? <OperationHooksEditor snapshot={snapshot} capability={{ interactable: variable.interactable, operations: variable.operations, hooks: variable.hooks }} onChange={(capability) => onChange({ ...variable, ...capability })} /> : null}
  </div>;
}

function ComputedEditor({ computed, snapshot, onChange }: { computed: ComputedDefinition; snapshot: ProjectSnapshot; onChange: (value: ComputedDefinition) => void }) {
  return <div className="definition-form focused-definition-form">
    <label>KEY <input value={computed.key} onChange={(event) => onChange({ ...computed, key: normalizeKey(event.target.value) })} /></label>
    <label>LABEL <input value={computed.label} onChange={(event) => onChange({ ...computed, label: event.target.value })} /></label>
    <label>SAFE RUNTIME SOURCE <select value={computed.source} onChange={(event) => onChange({ ...computed, source: event.target.value as ComputedDefinition["source"] })}><option value="elapsed_seconds">elapsed client-session seconds</option><option value="commands_entered">commands entered</option><option value="inventory_slots_used">inventory slots used</option><option value="visited_nodes">distinct visited nodes</option></select></label>
    <label>FORMAT <select value={computed.format} onChange={(event) => onChange({ ...computed, format: event.target.value as ComputedDefinition["format"] })}><option value="raw">raw</option><option value="integer">rounded integer</option><option value="seconds">seconds with unit</option></select></label>
    <label className="check-label"><input type="checkbox" checked={computed.showInStatus} onChange={(event) => onChange({ ...computed, showInStatus: event.target.checked })} /> show in inventory/status</label>
    {computed.showInStatus ? <OperationHooksEditor snapshot={snapshot} capability={{ interactable: computed.interactable, operations: computed.operations, hooks: computed.hooks }} onChange={(capability) => onChange({ ...computed, ...capability })} /> : null}
  </div>;
}

function EntityEditor({ entity, onChange }: { entity: EntityDefinition; onChange: (value: EntityDefinition) => void }) {
  return <div className="definition-form focused-definition-form">
    <label>TYPE <select value={entity.type} onChange={(event) => onChange({ ...entity, type: event.target.value as EntityDefinition["type"] })}><option value="character">character</option><option value="location">location</option></select></label>
    <label>KEY <input value={entity.key} onChange={(event) => onChange({ ...entity, key: normalizeKey(event.target.value) })} /></label>
    <label>NAME <input value={entity.name} onChange={(event) => onChange({ ...entity, name: event.target.value })} /></label>
    <label>DESCRIPTION <textarea rows={3} value={entity.description} onChange={(event) => onChange({ ...entity, description: event.target.value })} /></label>
    <label>TAGS <input value={entity.tags.join(", ")} onChange={(event) => onChange({ ...entity, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
  </div>;
}

function EditorFooter({ saving, onSave, onCancel }: { saving: boolean; onSave: () => void; onCancel: () => void }) {
  return <div className="author-actions author-panel-footer definition-detail-footer">
    <button type="button" disabled={saving} onClick={onSave}>[{saving ? "SAVING..." : "SAVE"}]</button>
    <button type="button" onClick={onCancel}>[CANCEL]</button>
  </div>;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+/, "");
}

function InitialValueInput({ definition, onChange }: { definition: VariableDefinition; onChange: (value: Value) => void }) {
  if (definition.valueType === "boolean") return <select value={String(definition.initialValue)} onChange={(event) => onChange(event.target.value === "true")}><option value="false">false</option><option value="true">true</option></select>;
  if (definition.valueType === "number") return <input type="number" value={Number(definition.initialValue ?? 0)} onChange={(event) => onChange(Number(event.target.value))} />;
  return <input value={String(definition.initialValue ?? "")} onChange={(event) => onChange(event.target.value)} />;
}
