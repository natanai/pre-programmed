import { useEffect, useState, type CSSProperties } from "react";
import { assetUrl } from "../data/assets";
import { executeEffects, type EffectEvent } from "../game/effects";
import { interpolateText } from "../game/interpolation";
import {
  attemptInventoryOperation,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  type InventoryOperationRequest,
} from "../game/inventory";
import type {
  ItemDefinition,
  ItemOperationHook,
  MutationOperation,
  PlayState,
  ProjectSnapshot,
} from "../game/model";
import { readComputedValue } from "../game/runtimeValues";
import { ASSET_MANIFEST } from "../generated/assetManifest";
import { ConditionEditor, EffectsEditor, ValueTokenBar } from "./AuthorFields";

export function Inventory({
  snapshot,
  state,
  authorMode,
  onState,
  onOutput,
  onEvents,
  onEditItem,
  onCreateItem,
  onClose,
}: {
  snapshot: ProjectSnapshot;
  state: PlayState;
  authorMode: boolean;
  onState: (state: PlayState) => void;
  onOutput: (text: string) => void;
  onEvents: (events: EffectEvent[]) => void;
  onEditItem: (item: ItemDefinition) => void;
  onCreateItem: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const selectedEntry = state.inventory.find((entry) => entry.instanceId === selected);
  const selectedItem = snapshot.items.find((item) => item.id === selectedEntry?.itemId);

  const operate = (request: InventoryOperationRequest) => {
    const attempt = attemptInventoryOperation(snapshot, state, request);
    const execution = executeEffects(snapshot, attempt.state, attempt.effects);
    onState(execution.state);
    onEvents(execution.events.map((event) => event.type === "notification"
      ? { ...event, text: interpolateText(event.text, { snapshot, state: execution.state }) }
      : event));
    const output = interpolateText(attempt.responseText, { snapshot, state: execution.state });
    if (output) onOutput(output);
    if (request.operation === "remove" && attempt.accepted) setSelected(null);
  };

  const moveSelected = (x: number, y: number) => {
    if (!selected) return;
    operate({ operation: "move", instanceId: selected, target: { x, y } });
  };

  return <section className="inventory-surface" aria-label="Inventory" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>INVENTORY / STATUS</span><button type="button" onClick={onClose}>[X]</button></header>
    <div className="status-readout">
      {snapshot.variables.filter((item) => item.showInStatus).map((definition) => <div key={definition.id}><span>{definition.label}</span><strong>{String(state.values[definition.key] ?? "")}</strong></div>)}
      {snapshot.computedValues.filter((item) => item.showInStatus).map((definition) => {
        const value = readComputedValue(definition, snapshot, state, now);
        const formatted = typeof value === "number" && definition.format === "integer"
          ? String(Math.round(value))
          : typeof value === "number" && definition.format === "seconds"
            ? `${Math.round(value)}s`
            : String(value);
        return <div key={definition.id}><span>{definition.label}</span><strong>{formatted}</strong></div>;
      })}
      {!snapshot.variables.some((item) => item.showInStatus) && !snapshot.computedValues.some((item) => item.showInStatus) ? <span className="muted">No status values are exposed.</span> : null}
    </div>
    <div className="inventory-layout">
      <div className="inventory-grid" style={{ "--columns": INVENTORY_COLUMNS, "--rows": INVENTORY_ROWS } as CSSProperties}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = Math.floor((event.clientX - bounds.left) / (bounds.width / INVENTORY_COLUMNS));
          const y = Math.floor((event.clientY - bounds.top) / (bounds.height / INVENTORY_ROWS));
          const instanceId = event.dataTransfer.getData("text/pre-programmed-instance");
          if (instanceId) operate({ operation: "move", instanceId, target: { x, y } });
        }}>
        {Array.from({ length: INVENTORY_COLUMNS * INVENTORY_ROWS }, (_, index) => {
          const x = index % INVENTORY_COLUMNS;
          const y = Math.floor(index / INVENTORY_COLUMNS);
          return <button type="button" className="inventory-cell" key={index} aria-label={`Inventory cell ${x + 1}, ${y + 1}`} onClick={() => moveSelected(x, y)} />;
        })}
        {state.inventory.map((entry) => {
          const item = snapshot.items.find((candidate) => candidate.id === entry.itemId);
          if (!item) return null;
          return <button type="button" draggable className={`inventory-item${selected === entry.instanceId ? " selected" : ""}`} key={entry.instanceId}
            style={{ "--x": entry.x, "--y": entry.y, "--w": item.width, "--h": item.height } as CSSProperties}
            onDragStart={(event) => event.dataTransfer.setData("text/pre-programmed-instance", entry.instanceId)}
            onClick={(event) => { event.stopPropagation(); setSelected(entry.instanceId); }}>
            {item.assetPath ? <img src={assetUrl(item.assetPath)} alt="" draggable={false} /> : <span>{item.name.slice(0, 3).toUpperCase()}</span>}
            {entry.quantity > 1 ? <b>{entry.quantity}</b> : null}
          </button>;
        })}
      </div>
      <aside className="inventory-inspector">
        {selectedEntry && selectedItem ? <>
          <strong>{selectedItem.name}</strong><p>{selectedItem.description}</p>
          <div className="operation-buttons"><button type="button" onClick={() => operate({ operation: "inspect", instanceId: selectedEntry.instanceId })}>[INSPECT]</button><button type="button" onClick={() => operate({ operation: "use", instanceId: selectedEntry.instanceId })}>[USE]</button><button type="button" onClick={() => operate({ operation: "remove", instanceId: selectedEntry.instanceId })}>[DROP]</button></div>
          {authorMode ? <button type="button" onClick={() => onEditItem(selectedItem)}>[EDIT DEFINITION]</button> : null}
        </> : <p>Tap an item, then tap a cell to move it. Desktop also supports drag and drop.</p>}
      </aside>
    </div>
    {authorMode ? <div className="author-actions"><button type="button" onClick={onCreateItem}>[+ ITEM DEFINITION]</button></div> : null}
  </section>;
}

function emptyItem(): ItemDefinition {
  return {
    id: crypto.randomUUID(), key: "", name: "", description: "", assetPath: "", width: 1, height: 1,
    stackable: false, maxStack: 1, removable: true, tags: [], initialState: {}, hooks: [],
  };
}

function emptyHook(order: number): ItemOperationHook {
  return { id: crypto.randomUUID(), operation: "inspect", order, condition: { type: "always" }, responseText: "", effects: [], success: true };
}

export function ItemEditor({ snapshot, initial, onSave, onCancel }: {
  snapshot: ProjectSnapshot;
  initial?: ItemDefinition;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial ?? emptyItem()));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!draft.key || !draft.name) return;
    setSaving(true);
    try { await onSave([{ type: "item.upsert", item: draft }], `${initial ? "Changed" : "Created"} item ${draft.name}`); }
    finally { setSaving(false); }
  };
  return <section className="author-panel item-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>ITEM DEFINITION</span><button type="button" onClick={onCancel}>[X]</button></header>
    <div className="form-grid">
      <label>KEY <input value={draft.key} onChange={(event) => setDraft({ ...draft, key: event.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") })} /></label>
      <label>NAME <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label>DESCRIPTION <textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      <label>ASSET <select value={draft.assetPath} onChange={(event) => setDraft({ ...draft, assetPath: event.target.value })}><option value="">none / text tile</option>{ASSET_MANIFEST.filter((asset) => asset.type === "image" && asset.runtimePath).map((asset) => <option value={asset.runtimePath!} key={asset.path}>{asset.path}</option>)}</select></label>
      <label>WIDTH <input type="number" min={1} max={10} value={draft.width} onChange={(event) => setDraft({ ...draft, width: Number(event.target.value) })} /></label>
      <label>HEIGHT <input type="number" min={1} max={6} value={draft.height} onChange={(event) => setDraft({ ...draft, height: Number(event.target.value) })} /></label>
      <label className="check-label"><input type="checkbox" checked={draft.stackable} onChange={(event) => setDraft({ ...draft, stackable: event.target.checked })} /> stackable</label>
      <label>MAX STACK <input type="number" min={1} value={draft.maxStack} onChange={(event) => setDraft({ ...draft, maxStack: Number(event.target.value) })} /></label>
      <label className="check-label"><input type="checkbox" checked={draft.removable} onChange={(event) => setDraft({ ...draft, removable: event.target.checked })} /> removal succeeds without a hook</label>
      <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
    </div>
    <h3>OPERATION HOOKS</h3>
    {draft.hooks.map((hook, index) => <fieldset className="operation-hook" key={hook.id}><legend>HOOK {index + 1}</legend>
      <div className="hook-head"><select value={hook.operation} onChange={(event) => updateHook(draft, setDraft, hook.id, { ...hook, operation: event.target.value as ItemOperationHook["operation"] })}><option value="inspect">inspect</option><option value="use">use</option><option value="move">move attempt</option><option value="remove">drop/remove attempt</option></select><label className="check-label"><input type="checkbox" checked={hook.success} onChange={(event) => updateHook(draft, setDraft, hook.id, { ...hook, success: event.target.checked })} /> operation succeeds</label><button type="button" onClick={() => moveHook(draft, setDraft, index, -1)}>[↑]</button><button type="button" onClick={() => moveHook(draft, setDraft, index, 1)}>[↓]</button><button type="button" onClick={() => setDraft({ ...draft, hooks: draft.hooks.filter((item) => item.id !== hook.id).map((item, itemIndex) => ({ ...item, order: itemIndex })) })}>[REMOVE]</button></div>
      <div className="attempt-presets"><span>WHEN:</span><button type="button" onClick={() => updateHook(draft, setDraft, hook.id, { ...hook, condition: { type: "attempt", operator: "eq", value: 1 } })}>[FIRST]</button><button type="button" onClick={() => updateHook(draft, setDraft, hook.id, { ...hook, condition: { type: "attempt", operator: "gte", value: 2 } })}>[2+]</button></div>
      <ConditionEditor condition={hook.condition} snapshot={snapshot} onChange={(condition) => updateHook(draft, setDraft, hook.id, { ...hook, condition })} />
      <label>OUTPUT <textarea rows={2} value={hook.responseText} onChange={(event) => updateHook(draft, setDraft, hook.id, { ...hook, responseText: event.target.value })} /></label>
      <ValueTokenBar snapshot={snapshot} onInsert={(token) => updateHook(draft, setDraft, hook.id, { ...hook, responseText: hook.responseText + token })} />
      <EffectsEditor effects={hook.effects} snapshot={snapshot} onChange={(effects) => updateHook(draft, setDraft, hook.id, { ...hook, effects })} />
    </fieldset>)}
    <button type="button" onClick={() => setDraft({ ...draft, hooks: [...draft.hooks, emptyHook(draft.hooks.length)] })}>[+ OPERATION HOOK]</button>
    <div className="author-actions"><button type="button" disabled={saving} onClick={() => void save()}>[SAVE]</button><button type="button" onClick={onCancel}>[CANCEL]</button></div>
  </section>;
}

function updateHook(draft: ItemDefinition, setDraft: (item: ItemDefinition) => void, id: string, hook: ItemOperationHook) {
  setDraft({ ...draft, hooks: draft.hooks.map((item) => item.id === id ? hook : item) });
}

function moveHook(draft: ItemDefinition, setDraft: (item: ItemDefinition) => void, index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= draft.hooks.length) return;
  const hooks = [...draft.hooks];
  [hooks[index], hooks[target]] = [hooks[target], hooks[index]];
  setDraft({ ...draft, hooks: hooks.map((hook, order) => ({ ...hook, order })) });
}
