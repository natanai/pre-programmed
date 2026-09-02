import { useEffect, useState } from "react";
import { GeneratedKeyField } from "../../../author/GeneratedKeyField";
import { resolveAuthorKey } from "../../../author/generatedKey";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type {
  ComputedDefinition,
  VariableDefinition,
} from "../model";
import type { EntityDefinition } from "../../world/model";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import type { Value } from "../../../engine/rules/model";
import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import "./definitionsPanel.css";

type Mode = "variables" | "computed" | "entities";
export type StateAuthorResourceKind = "variable" | "number-variable" | "flag" | "computed" | "character" | "location";

function normalizedVariable(item: VariableDefinition): VariableDefinition {
  return {
    ...structuredClone(item),
    interactable: item.interactable ?? false,
    operations: item.operations ?? [],
    hooks: item.hooks ?? [],
    timeRate: item.timeRate ?? 0,
    timeUnit: item.timeUnit ?? "second",
  };
}

function newVariable(valueType: VariableDefinition["valueType"] = "number"): VariableDefinition {
  return {
    id: crypto.randomUUID(),
    key: "",
    label: "",
    valueType,
    initialValue: valueType === "number" ? 0 : valueType === "boolean" ? false : "",
    showInStatus: false,
    interactable: false,
    operations: [],
    hooks: [],
    timeRate: 0,
    timeUnit: "second",
  };
}

function normalizedComputed(item: ComputedDefinition): ComputedDefinition {
  return {
    ...structuredClone(item),
    interactable: item.interactable ?? false,
    operations: item.operations ?? [],
    hooks: item.hooks ?? [],
  };
}

function newComputed(): ComputedDefinition {
  return {
    id: crypto.randomUUID(), key: "", label: "", source: "elapsed_seconds", format: "integer",
    showInStatus: false, interactable: false, operations: [], hooks: [],
  };
}

function normalizedEntity(item: EntityDefinition): EntityDefinition {
  return {
    ...structuredClone(item),
    interactable: item.interactable ?? false,
    operations: item.operations ?? [],
    hooks: item.hooks ?? [],
  };
}

function newEntity(type: EntityDefinition["type"]): EntityDefinition {
  return {
    id: crypto.randomUUID(), key: "", type, name: "", description: "", tags: [],
    interactable: false, operations: [], hooks: [],
  };
}

function modeForResource(kind?: StateAuthorResourceKind): Mode {
  if (kind === "computed") return "computed";
  if (kind === "character" || kind === "location") return "entities";
  return "variables";
}

function variableTypeForResource(kind?: StateAuthorResourceKind): VariableDefinition["valueType"] | undefined {
  if (kind === "flag") return "boolean";
  if (kind === "number-variable") return "number";
  return undefined;
}

export function DefinitionsPanel({ snapshot, onSave, onClose, setWorkspaceDirty, resourceKind, resourceId, preferredOperation }: {
  snapshot: ProjectSnapshot;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onClose: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
  resourceKind?: StateAuthorResourceKind;
  resourceId?: string;
  preferredOperation?: string;
}) {
  const resourceMode = Boolean(resourceKind);
  const lockedVariableType = variableTypeForResource(resourceKind);
  const lockedEntityType = resourceKind === "character" || resourceKind === "location" ? resourceKind : undefined;
  const [mode, setMode] = useState<Mode>(() => modeForResource(resourceKind));
  const [variable, setVariable] = useState<VariableDefinition | null>(() => {
    if (!resourceKind || !["variable", "number-variable", "flag"].includes(resourceKind)) return null;
    const existing = resourceId ? snapshot.variables.find((item) => item.id === resourceId) : undefined;
    return existing ? normalizedVariable(existing) : newVariable(lockedVariableType ?? "number");
  });
  const [computed, setComputed] = useState<ComputedDefinition | null>(() => {
    if (resourceKind !== "computed") return null;
    const existing = resourceId ? snapshot.computedValues.find((item) => item.id === resourceId) : undefined;
    return existing ? normalizedComputed(existing) : newComputed();
  });
  const [entity, setEntity] = useState<EntityDefinition | null>(() => {
    if (resourceKind !== "character" && resourceKind !== "location") return null;
    const existing = resourceId ? snapshot.entities.find((item) => item.id === resourceId) : undefined;
    return existing ? normalizedEntity(existing) : newEntity(resourceKind);
  });
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState(() => JSON.stringify(variable ?? computed ?? entity));
  const editing = Boolean(variable || computed || entity);
  const selectedId = variable?.id ?? computed?.id ?? entity?.id;
  const currentSignature = JSON.stringify(variable ?? computed ?? entity);
  const dirty = editing && currentSignature !== baseline;

  useEffect(() => {
    setWorkspaceDirty(dirty);
    return () => setWorkspaceDirty(false);
  }, [dirty, setWorkspaceDirty]);

  const resetEditor = () => {
    setVariable(null);
    setComputed(null);
    setEntity(null);
    setBaseline(JSON.stringify(null));
  };

  const openVariable = (item: VariableDefinition) => {
    const next = normalizedVariable(item);
    setComputed(null);
    setEntity(null);
    setMode("variables");
    setVariable(next);
    setBaseline(JSON.stringify(next));
  };

  const openComputed = (item: ComputedDefinition) => {
    const next = normalizedComputed(item);
    setVariable(null);
    setEntity(null);
    setMode("computed");
    setComputed(next);
    setBaseline(JSON.stringify(next));
  };

  const openEntity = (item: EntityDefinition) => {
    const next = normalizedEntity(item);
    setVariable(null);
    setComputed(null);
    setMode("entities");
    setEntity(next);
    setBaseline(JSON.stringify(next));
  };

  const saveVariable = async () => {
    if (!variable?.label.trim()) return;
    const definition = {
      ...variable,
      valueType: lockedVariableType ?? variable.valueType,
      key: resolveAuthorKey({
        override: variable.key,
        source: variable.label,
        existingKeys: snapshot.variables.filter((item) => item.id !== variable.id).map((item) => item.key),
        fallback: "variable",
      }),
    };
    setVariable(definition);
    setSaving(true);
    try {
      const result = await onSave([{ type: "variable.upsert", definition }], `Changed variable ${definition.label}`);
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify(definition));
        setWorkspaceDirty(false);
      }
    } finally { setSaving(false); }
  };

  const saveComputed = async () => {
    if (!computed?.label.trim()) return;
    const definition = {
      ...computed,
      key: resolveAuthorKey({
        override: computed.key,
        source: computed.label,
        existingKeys: snapshot.computedValues.filter((item) => item.id !== computed.id).map((item) => item.key),
        fallback: "computed",
      }),
    };
    setComputed(definition);
    setSaving(true);
    try {
      const result = await onSave([{ type: "computed.upsert", definition }], `Changed computed value ${definition.label}`);
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify(definition));
        setWorkspaceDirty(false);
      }
    } finally { setSaving(false); }
  };

  const saveEntity = async () => {
    if (!entity?.name.trim()) return;
    const savedEntity = {
      ...entity,
      type: lockedEntityType ?? entity.type,
      key: resolveAuthorKey({
        override: entity.key,
        source: entity.name,
        existingKeys: snapshot.entities.filter((item) => item.id !== entity.id).map((item) => item.key),
        fallback: entity.type,
      }),
    };
    setEntity(savedEntity);
    setSaving(true);
    try {
      const result = await onSave([{ type: "entity.upsert", entity: savedEntity }], `Changed ${savedEntity.type} ${savedEntity.name}`);
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify(savedEntity));
        setWorkspaceDirty(false);
      }
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
  const cancelEditor = resourceMode ? onClose : resetEditor;

  return <section className={`author-panel author-panel-frame definitions-panel${resourceMode ? " is-resource-task" : ""}`} onPointerDown={(event) => event.stopPropagation()}>
    <header>
      <span>{title}</span>
      {editing && !resourceMode ? <span className="definition-header-context">STATE + PEOPLE</span> : null}
    </header>
    <div className={`author-panel-body definitions-panel-body${editing ? " is-editing" : ""}`}>
      {!resourceMode ? <div className="definitions-master-pane">
        <DefinitionIndex
          snapshot={snapshot}
          mode={mode}
          selectedId={selectedId}
          onMode={(nextMode) => { setMode(nextMode); resetEditor(); }}
          onVariable={openVariable}
          onComputed={openComputed}
          onEntity={openEntity}
          onNewVariable={() => openVariable(newVariable())}
          onNewComputed={() => openComputed(newComputed())}
          onNewEntity={(type) => openEntity(newEntity(type))}
        />
      </div> : null}
      {editing ? <div className="definitions-detail-pane">
        <button type="button" className="definition-back" onClick={cancelEditor}>[← {resourceMode ? "CANCEL" : backLabel}]</button>
        <div className="definition-detail-scroll">
          {variable ? <VariableEditor variable={variable} snapshot={snapshot} lockedValueType={lockedVariableType} preferredOperation={preferredOperation} onChange={setVariable} /> : null}
          {computed ? <ComputedEditor computed={computed} snapshot={snapshot} preferredOperation={preferredOperation} onChange={setComputed} /> : null}
          {entity ? <EntityEditor entity={entity} snapshot={snapshot} lockedType={lockedEntityType} preferredOperation={preferredOperation} onChange={setEntity} /> : null}
        </div>
        {variable ? <EditorFooter saving={saving} onSave={() => void saveVariable()} onCancel={cancelEditor} /> : null}
        {computed ? <EditorFooter saving={saving} onSave={() => void saveComputed()} onCancel={cancelEditor} /> : null}
        {entity ? <EditorFooter saving={saving} onSave={() => void saveEntity()} onCancel={cancelEditor} /> : null}
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
            placeholder={mode === "variables" ? "variable name" : mode === "computed" ? "computed value or source" : "person, place, or tag"}
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
          detail={`${item.valueType}${item.valueType === "number" && item.timeRate ? ` · ${item.timeRate > 0 ? "+" : ""}${item.timeRate}/${item.timeUnit ?? "second"}` : ""}`}
          selected={selectedId === item.id}
          onOpen={() => onVariable(item)}
        />)}</div> : <div className="definition-empty">{normalizedQuery ? "NO MATCHING VARIABLES." : "NO VARIABLES YET."}</div>}
      </section> : null}

      {mode === "computed" ? <section className="definition-index-section">
        {computedValues.length ? <div className="definition-list">{computedValues.map((item) => <DefinitionRow
          key={item.id}
          title={item.label || item.key || "Untitled computed value"}
          detail={item.source}
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
    {items.length ? <div className="definition-list">{items.map((item) => <DefinitionRow
      key={item.id}
      title={item.name || item.key || `Untitled ${item.type}`}
      detail={item.description.trim() || `${item.tags.length} tag${item.tags.length === 1 ? "" : "s"}`}
      selected={selectedId === item.id}
      onOpen={() => onOpen(item)}
    />)}</div> : <div className="definition-empty">{empty}</div>}
  </section>;
}

function VariableEditor({ variable, snapshot, lockedValueType, preferredOperation, onChange }: {
  variable: VariableDefinition;
  snapshot: ProjectSnapshot;
  lockedValueType?: VariableDefinition["valueType"];
  preferredOperation?: string;
  onChange: (value: VariableDefinition) => void;
}) {
  return <div className="definition-form focused-definition-form">
    <label>LABEL <input value={variable.label} onChange={(event) => onChange({ ...variable, label: event.target.value })} autoFocus /></label>
    <label>TYPE <select disabled={Boolean(lockedValueType)} value={lockedValueType ?? variable.valueType} onChange={(event) => {
      const valueType = event.target.value as VariableDefinition["valueType"];
      onChange({ ...variable, valueType, initialValue: valueType === "number" ? 0 : valueType === "boolean" ? false : "", timeRate: valueType === "number" ? variable.timeRate ?? 0 : 0 });
    }}><option value="number">number</option><option value="boolean">boolean / flag</option><option value="string">text / enum</option></select></label>
    <label>INITIAL VALUE <InitialValueInput definition={{ ...variable, valueType: lockedValueType ?? variable.valueType }} onChange={(initialValue) => onChange({ ...variable, initialValue })} /></label>
    {(lockedValueType ?? variable.valueType) === "number" ? <div className="time-change-setting">
      <label>CHANGE OVER TIME (+/-) <input aria-label="Change over time amount" type="number" step="any" value={variable.timeRate ?? 0} onChange={(event) => onChange({ ...variable, timeRate: Number(event.target.value) })} /></label>
      <label>PER <select aria-label="Time change unit" value={variable.timeUnit ?? "second"} onChange={(event) => onChange({ ...variable, timeUnit: event.target.value as "second" | "minute" | "hour" })}><option value="second">second</option><option value="minute">minute</option><option value="hour">hour</option></select></label>
    </div> : null}
    <label className="check-label"><input type="checkbox" checked={variable.showInStatus} onChange={(event) => onChange({ ...variable, showInStatus: event.target.checked })} /> show in inventory/status</label>
    <OperationHooksEditor snapshot={snapshot} targetKind="state.variable" defaultOpen={Boolean(preferredOperation)} preferredOperation={preferredOperation} capability={{ interactable: variable.interactable, operations: variable.operations, hooks: variable.hooks }} onChange={(capability) => onChange({ ...variable, ...capability })} />
    <GeneratedKeyField source={variable.label} value={variable.key} onChange={(key) => onChange({ ...variable, key })} />
  </div>;
}

function ComputedEditor({ computed, snapshot, preferredOperation, onChange }: { computed: ComputedDefinition; snapshot: ProjectSnapshot; preferredOperation?: string; onChange: (value: ComputedDefinition) => void }) {
  return <div className="definition-form focused-definition-form">
    <label>LABEL <input value={computed.label} onChange={(event) => onChange({ ...computed, label: event.target.value })} autoFocus /></label>
    <label>SAFE RUNTIME SOURCE <select value={computed.source} onChange={(event) => onChange({ ...computed, source: event.target.value as ComputedDefinition["source"] })}><option value="elapsed_seconds">elapsed client-session seconds</option><option value="commands_entered">commands entered</option><option value="inventory_slots_used">inventory slots used</option><option value="visited_nodes">distinct visited nodes</option></select></label>
    <label>FORMAT <select value={computed.format} onChange={(event) => onChange({ ...computed, format: event.target.value as ComputedDefinition["format"] })}><option value="raw">raw</option><option value="integer">rounded integer</option><option value="seconds">seconds with unit</option></select></label>
    <label className="check-label"><input type="checkbox" checked={computed.showInStatus} onChange={(event) => onChange({ ...computed, showInStatus: event.target.checked })} /> show in inventory/status</label>
    <OperationHooksEditor snapshot={snapshot} targetKind="state.computed" defaultOpen={Boolean(preferredOperation)} preferredOperation={preferredOperation} capability={{ interactable: computed.interactable, operations: computed.operations, hooks: computed.hooks }} onChange={(capability) => onChange({ ...computed, ...capability })} />
    <GeneratedKeyField source={computed.label} value={computed.key} onChange={(key) => onChange({ ...computed, key })} />
  </div>;
}

function EntityEditor({ entity, snapshot, lockedType, preferredOperation, onChange }: {
  entity: EntityDefinition;
  snapshot: ProjectSnapshot;
  lockedType?: EntityDefinition["type"];
  preferredOperation?: string;
  onChange: (value: EntityDefinition) => void;
}) {
  return <div className="definition-form focused-definition-form">
    <label>NAME <input value={entity.name} onChange={(event) => onChange({ ...entity, name: event.target.value })} autoFocus /></label>
    <label>TYPE <select disabled={Boolean(lockedType)} value={lockedType ?? entity.type} onChange={(event) => onChange({ ...entity, type: event.target.value as EntityDefinition["type"] })}><option value="character">character</option><option value="location">location</option></select></label>
    <label>DESCRIPTION <textarea rows={3} value={entity.description} onChange={(event) => onChange({ ...entity, description: event.target.value })} /></label>
    <label>TAGS <input value={entity.tags.join(", ")} onChange={(event) => onChange({ ...entity, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
    <OperationHooksEditor
      snapshot={snapshot}
      targetKind={(lockedType ?? entity.type) === "character" ? "world.character" : "world.location"}
      defaultOpen={Boolean(preferredOperation)}
      preferredOperation={preferredOperation}
      capability={{
        interactable: entity.interactable ?? false,
        operations: entity.operations ?? [],
        hooks: entity.hooks ?? [],
      }}
      onChange={(capability) => onChange({ ...entity, ...capability })}
    />
    <GeneratedKeyField source={entity.name} value={entity.key} onChange={(key) => onChange({ ...entity, key })} />
  </div>;
}

function EditorFooter({ saving, onSave, onCancel }: { saving: boolean; onSave: () => void; onCancel: () => void }) {
  return <div className="author-actions author-panel-footer definition-detail-footer">
    <button type="button" disabled={saving} onClick={onSave}>[{saving ? "SAVING..." : "SAVE"}]</button>
    <button type="button" onClick={onCancel}>[CANCEL]</button>
  </div>;
}

function InitialValueInput({ definition, onChange }: { definition: VariableDefinition; onChange: (value: Value) => void }) {
  if (definition.valueType === "boolean") return <select value={String(definition.initialValue)} onChange={(event) => onChange(event.target.value === "true")}><option value="false">false</option><option value="true">true</option></select>;
  if (definition.valueType === "number") return <input type="number" value={Number(definition.initialValue ?? 0)} onChange={(event) => onChange(Number(event.target.value))} />;
  return <input value={String(definition.initialValue ?? "")} onChange={(event) => onChange(event.target.value)} />;
}
