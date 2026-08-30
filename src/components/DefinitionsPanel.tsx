import { useState } from "react";
import type {
  ComputedDefinition,
  EntityDefinition,
  MutationOperation,
  ProjectSnapshot,
  VariableDefinition,
  Value,
} from "../game/model";
import { OperationHooksEditor } from "./OperationHooksEditor";

export function DefinitionsPanel({ snapshot, onSave, onClose }: {
  snapshot: ProjectSnapshot;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"variables" | "computed" | "entities">("variables");
  const [variable, setVariable] = useState<VariableDefinition | null>(null);
  const [computed, setComputed] = useState<ComputedDefinition | null>(null);
  const [entity, setEntity] = useState<EntityDefinition | null>(null);
  const [saving, setSaving] = useState(false);

  const saveVariable = async () => {
    if (!variable?.key.trim() || !variable.label.trim()) return;
    setSaving(true);
    try {
      await onSave([{ type: "variable.upsert", definition: variable }], `Changed variable ${variable.label}`);
      setVariable(null);
    } finally { setSaving(false); }
  };
  const saveComputed = async () => {
    if (!computed?.key.trim() || !computed.label.trim()) return;
    setSaving(true);
    try {
      await onSave([{ type: "computed.upsert", definition: computed }], `Changed computed value ${computed.label}`);
      setComputed(null);
    } finally { setSaving(false); }
  };
  const saveEntity = async () => {
    if (!entity?.key.trim() || !entity.name.trim()) return;
    setSaving(true);
    try {
      await onSave([{ type: "entity.upsert", entity }], `Changed ${entity.type} ${entity.name}`);
      setEntity(null);
    } finally { setSaving(false); }
  };

  return <section className="author-panel definitions-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>STATE DEFINITIONS</span><button type="button" onClick={onClose}>[X]</button></header>
    <nav className="panel-tabs"><button type="button" aria-pressed={mode === "variables"} onClick={() => setMode("variables")}>[VARIABLES]</button><button type="button" aria-pressed={mode === "computed"} onClick={() => setMode("computed")}>[COMPUTED]</button><button type="button" aria-pressed={mode === "entities"} onClick={() => setMode("entities")}>[CHARACTERS / LOCATIONS]</button></nav>
    {mode === "variables" ? <>
      <div className="definition-list">{snapshot.variables.map((item) => <button type="button" key={item.id} onClick={() => setVariable({ ...structuredClone(item), interactable: item.interactable ?? false, operations: item.operations ?? [], hooks: item.hooks ?? [] })}><span>{item.label}</span><span>{item.key} : {item.valueType}</span></button>)}</div>
      <button type="button" onClick={() => setVariable({ id: crypto.randomUUID(), key: "", label: "", valueType: "number", initialValue: 0, showInStatus: false, interactable: false, operations: [], hooks: [] })}>[+ VARIABLE]</button>
      {variable ? <div className="definition-form">
        <label>KEY <input value={variable.key} onChange={(event) => setVariable({ ...variable, key: normalizeKey(event.target.value) })} /></label>
        <label>LABEL <input value={variable.label} onChange={(event) => setVariable({ ...variable, label: event.target.value })} /></label>
        <label>TYPE <select value={variable.valueType} onChange={(event) => {
          const valueType = event.target.value as VariableDefinition["valueType"];
          setVariable({ ...variable, valueType, initialValue: valueType === "number" ? 0 : valueType === "boolean" ? false : "" });
        }}><option value="number">number</option><option value="boolean">boolean / flag</option><option value="string">text / enum</option></select></label>
        <label>INITIAL VALUE <InitialValueInput definition={variable} onChange={(initialValue) => setVariable({ ...variable, initialValue })} /></label>
        <label className="check-label"><input type="checkbox" checked={variable.showInStatus} onChange={(event) => setVariable({ ...variable, showInStatus: event.target.checked })} /> show in inventory/status</label>
        {variable.showInStatus ? <OperationHooksEditor snapshot={snapshot} capability={{ interactable: variable.interactable, operations: variable.operations, hooks: variable.hooks }} onChange={(capability) => setVariable({ ...variable, ...capability })} /> : null}
        <div className="author-actions"><button type="button" disabled={saving} onClick={() => void saveVariable()}>[SAVE]</button><button type="button" onClick={() => setVariable(null)}>[CANCEL]</button></div>
      </div> : null}
    </> : mode === "computed" ? <>
      <div className="definition-list">{snapshot.computedValues.map((item) => <button type="button" key={item.id} onClick={() => setComputed({ ...structuredClone(item), interactable: item.interactable ?? false, operations: item.operations ?? [], hooks: item.hooks ?? [] })}><span>{item.label}</span><span>{item.key} : {item.source}</span></button>)}</div>
      <button type="button" onClick={() => setComputed({ id: crypto.randomUUID(), key: "", label: "", source: "elapsed_seconds", format: "integer", showInStatus: false, interactable: false, operations: [], hooks: [] })}>[+ COMPUTED VALUE]</button>
      {computed ? <div className="definition-form">
        <label>KEY <input value={computed.key} onChange={(event) => setComputed({ ...computed, key: normalizeKey(event.target.value) })} /></label>
        <label>LABEL <input value={computed.label} onChange={(event) => setComputed({ ...computed, label: event.target.value })} /></label>
        <label>SAFE RUNTIME SOURCE <select value={computed.source} onChange={(event) => setComputed({ ...computed, source: event.target.value as ComputedDefinition["source"] })}><option value="elapsed_seconds">elapsed client-session seconds</option><option value="commands_entered">commands entered</option><option value="inventory_slots_used">inventory slots used</option><option value="visited_nodes">distinct visited nodes</option></select></label>
        <label>FORMAT <select value={computed.format} onChange={(event) => setComputed({ ...computed, format: event.target.value as ComputedDefinition["format"] })}><option value="raw">raw</option><option value="integer">rounded integer</option><option value="seconds">seconds with unit</option></select></label>
        <label className="check-label"><input type="checkbox" checked={computed.showInStatus} onChange={(event) => setComputed({ ...computed, showInStatus: event.target.checked })} /> show in inventory/status</label>
        {computed.showInStatus ? <OperationHooksEditor snapshot={snapshot} capability={{ interactable: computed.interactable, operations: computed.operations, hooks: computed.hooks }} onChange={(capability) => setComputed({ ...computed, ...capability })} /> : null}
        <div className="author-actions"><button type="button" disabled={saving} onClick={() => void saveComputed()}>[SAVE]</button><button type="button" onClick={() => setComputed(null)}>[CANCEL]</button></div>
      </div> : null}
    </> : <>
      <div className="definition-list">{snapshot.entities.map((item) => <button type="button" key={item.id} onClick={() => setEntity(structuredClone(item))}><span>{item.name}</span><span>{item.key} : {item.type}</span></button>)}</div>
      <button type="button" onClick={() => setEntity({ id: crypto.randomUUID(), key: "", type: "character", name: "", description: "", tags: [] })}>[+ CHARACTER / LOCATION]</button>
      {entity ? <div className="definition-form">
        <label>TYPE <select value={entity.type} onChange={(event) => setEntity({ ...entity, type: event.target.value as EntityDefinition["type"] })}><option value="character">character</option><option value="location">location</option></select></label>
        <label>KEY <input value={entity.key} onChange={(event) => setEntity({ ...entity, key: normalizeKey(event.target.value) })} /></label>
        <label>NAME <input value={entity.name} onChange={(event) => setEntity({ ...entity, name: event.target.value })} /></label>
        <label>DESCRIPTION <textarea rows={3} value={entity.description} onChange={(event) => setEntity({ ...entity, description: event.target.value })} /></label>
        <label>TAGS <input value={entity.tags.join(", ")} onChange={(event) => setEntity({ ...entity, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
        <div className="author-actions"><button type="button" disabled={saving} onClick={() => void saveEntity()}>[SAVE]</button><button type="button" onClick={() => setEntity(null)}>[CANCEL]</button></div>
      </div> : null}
    </>}
  </section>;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+/, "");
}

function InitialValueInput({ definition, onChange }: { definition: VariableDefinition; onChange: (value: Value) => void }) {
  if (definition.valueType === "boolean") return <select value={String(definition.initialValue)} onChange={(event) => onChange(event.target.value === "true")}><option value="false">false</option><option value="true">true</option></select>;
  if (definition.valueType === "number") return <input type="number" value={Number(definition.initialValue ?? 0)} onChange={(event) => onChange(Number(event.target.value))} />;
  return <input value={String(definition.initialValue ?? "")} onChange={(event) => onChange(event.target.value)} />;
}
