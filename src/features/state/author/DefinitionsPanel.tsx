import { useState } from "react";
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

export function DefinitionsPanel({ snapshot, onSave }: {
  snapshot: ProjectSnapshot;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("variables");
  const [variable, setVariable] = useState<VariableDefinition | null>(null);
  const [computed, setComputed] = useState<ComputedDefinition | null>(null);
  const [entity, setEntity] = useState<EntityDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(variable || computed || entity);

  const resetEditor = () => {
    setVariable(null);
    setComputed(null);
    setEntity(null);
  };

  const openVariable = (item: VariableDefinition) => {
    resetEditor();
    setMode("variables");
    setVariable({
      ...structuredClone(item),
      interactable: item.interactable ?? false,
      operations: item.operations ?? [],
      hooks: item.hooks ?? [],
      timeRate: item.timeRate ?? 0,
      timeUnit: item.timeUnit ?? "second",
    });
  };

  const openComputed = (item: ComputedDefinition) => {
    resetEditor();
    setMode("computed");
    setComputed({
      ...structuredClone(item),
      interactable: item.interactable ?? false,
      operations: item.operations ?? [],
      hooks: item.hooks ?? [],
    });
  };

  const openEntity = (item: EntityDefinition) => {
    resetEditor();
    setMode("entities");
    setEntity(structuredClone(item));
  };

  const saveVariable = async () => {
    if (!variable?.key.trim() || !variable.label.trim()) return;
    setSaving(true);
    try {
      await onSave([{ type: "variable.upsert", definition: variable }], `Changed variable ${variable.label}`);
    } finally { setSaving(false); }
  };

  const saveComputed = async () => {
    if (!computed?.key.trim() || !computed.label.trim()) return;
    setSaving(true);
    try {
      await onSave([{ type: "computed.upsert", definition: computed }], `Changed computed value ${computed.label}`);
    } finally { setSaving(false); }
  };

  const saveEntity = async () => {
    if (!entity?.key.trim() || !entity.name.trim()) return;
    setSaving(true);
    try {
      await onSave([{ type: "entity.upsert", entity }], `Changed ${entity.type} ${entity.name}`);
    } finally { setSaving(false); }
  };

  const title = variable
    ? `VARIABLE · ${variable.label || variable.key || "NEW"}`
    : computed
      ? `COMPUTED · ${computed.label || computed.key || "NEW"}`
      : entity
        ? `${entity.type.toUpperCase()} · ${entity.name || entity.key || "NEW"}`
        : "STATE + PEOPLE";

  return <section className="author-panel author-panel-frame definitions-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>{title}</span></header>
    <div className="author-panel-body definitions-panel-body">
      {!editing ? <DefinitionIndex
        snapshot={snapshot}
        mode={mode}
        onMode={setMode}
        onVariable={openVariable}
        onComputed={openComputed}
        onEntity={openEntity}
        onNewVariable={() => openVariable({ id: crypto.randomUUID(), key: "", label: "", valueType: "number", initialValue: 0, showInStatus: false, interactable: false, operations: [], hooks: [], timeRate: 0, timeUnit: "second" })}
        onNewComputed={() => openComputed({ id: crypto.randomUUID(), key: "", label: "", source: "elapsed_seconds", format: "integer", showInStatus: false, interactable: false, operations: [], hooks: [] })}
        onNewEntity={(type) => openEntity({ id: crypto.randomUUID(), key: "", type, name: "", description: "", tags: [] })}
      /> : <>
        <button type="button" className="definition-back" onClick={resetEditor}>[← BACK TO {mode === "variables" ? "VARIABLES" : mode === "computed" ? "COMPUTED" : "PEOPLE + PLACES"}]</button>
        {variable ? <VariableEditor variable={variable} snapshot={snapshot} onChange={setVariable} /> : null}
        {computed ? <ComputedEditor computed={computed} snapshot={snapshot} onChange={setComputed} /> : null}
        {entity ? <EntityEditor entity={entity} onChange={setEntity} /> : null}
      </>}
    </div>
    {variable ? <EditorFooter saving={saving} onSave={() => void saveVariable()} onCancel={resetEditor} /> : null}
    {computed ? <EditorFooter saving={saving} onSave={() => void saveComputed()} onCancel={resetEditor} /> : null}
    {entity ? <EditorFooter saving={saving} onSave={() => void saveEntity()} onCancel={resetEditor} /> : null}
  </section>;
}

function DefinitionIndex({ snapshot, mode, onMode, onVariable, onComputed, onEntity, onNewVariable, onNewComputed, onNewEntity }: {
  snapshot: ProjectSnapshot;
  mode: Mode;
  onMode: (mode: Mode) => void;
  onVariable: (item: VariableDefinition) => void;
  onComputed: (item: ComputedDefinition) => void;
  onEntity: (item: EntityDefinition) => void;
  onNewVariable: () => void;
  onNewComputed: () => void;
  onNewEntity: (type: EntityDefinition["type"]) => void;
}) {
  const characters = snapshot.entities.filter((item) => item.type === "character");
  const locations = snapshot.entities.filter((item) => item.type === "location");
  return <>
    <nav className="panel-tabs definition-tabs" aria-label="State and people categories">
      <button type="button" aria-pressed={mode === "variables"} onClick={() => onMode("variables")}>[VARIABLES]</button>
      <button type="button" aria-pressed={mode === "computed"} onClick={() => onMode("computed")}>[COMPUTED]</button>
      <button type="button" aria-pressed={mode === "entities"} onClick={() => onMode("entities")}>[PEOPLE + PLACES]</button>
    </nav>

    {mode === "variables" ? <section className="definition-index-section">
      <div className="definition-list">{snapshot.variables.map((item) => <button type="button" key={item.id} onClick={() => onVariable(item)}>
        <span>{item.label}</span>
        <span>{item.key} : {item.valueType}{item.valueType === "number" && item.timeRate ? ` / ${item.timeRate > 0 ? "+" : ""}${item.timeRate} per ${item.timeUnit ?? "second"}` : ""}</span>
      </button>)}</div>
      <button type="button" className="definition-create" onClick={onNewVariable}>[+ VARIABLE]</button>
    </section> : null}

    {mode === "computed" ? <section className="definition-index-section">
      <div className="definition-list">{snapshot.computedValues.map((item) => <button type="button" key={item.id} onClick={() => onComputed(item)}>
        <span>{item.label}</span><span>{item.key} : {item.source}</span>
      </button>)}</div>
      <button type="button" className="definition-create" onClick={onNewComputed}>[+ COMPUTED VALUE]</button>
    </section> : null}

    {mode === "entities" ? <section className="definition-index-section entity-index">
      <DefinitionKind title="CHARACTERS" items={characters} onOpen={onEntity} empty="No characters yet." />
      <button type="button" className="definition-create" onClick={() => onNewEntity("character")}>[+ CHARACTER]</button>
      <DefinitionKind title="LOCATIONS" items={locations} onOpen={onEntity} empty="No locations yet." />
      <button type="button" className="definition-create" onClick={() => onNewEntity("location")}>[+ LOCATION]</button>
    </section> : null}
  </>;
}

function DefinitionKind({ title, items, onOpen, empty }: { title: string; items: EntityDefinition[]; onOpen: (item: EntityDefinition) => void; empty: string }) {
  return <section className="definition-kind-group">
    <h3>{title}</h3>
    {items.length ? <div className="definition-list">{items.map((item) => <button type="button" key={item.id} onClick={() => onOpen(item)}><span>{item.name}</span><span>{item.key}</span></button>)}</div> : <div className="definition-empty">{empty}</div>}
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
  return <div className="author-actions author-panel-footer">
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
