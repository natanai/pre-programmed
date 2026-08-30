import { useEffect, useState, type CSSProperties } from "react";
import { assetUrl } from "../data/assets";
import { type EffectEvent } from "../game/effects";
import {
  addInventoryItem,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
} from "../game/inventory";
import type {
  InventoryOperation,
  ItemDefinition,
  MutationOperation,
  OperationTarget,
  PlayState,
  ProjectSnapshot,
} from "../game/model";
import { executeOperation, type OperationRequest } from "../game/operations";
import { readComputedValue } from "../game/runtimeValues";
import { ASSET_MANIFEST } from "../generated/assetManifest";
import { OperationHooksEditor } from "./OperationHooksEditor";

export function Inventory({
  snapshot,
  state,
  authorMode,
  onState,
  onOutput,
  onEvents,
  onEditItem,
  onCreateItem,
  onSave,
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
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<OperationTarget | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const selectedEntry = selected?.kind === "item" ? state.inventory.find((entry) => entry.instanceId === selected.id) : undefined;
  const selectedItem = snapshot.items.find((item) => item.id === selectedEntry?.itemId);
  const selectedVariable = selected?.kind === "variable" ? snapshot.variables.find((item) => item.id === selected.id) : undefined;
  const selectedComputed = selected?.kind === "computed" ? snapshot.computedValues.find((item) => item.id === selected.id) : undefined;

  const operate = (request: OperationRequest) => {
    const execution = executeOperation(snapshot, state, request);
    onState(execution.state);
    onEvents(execution.events);
    if (execution.responseText) onOutput(execution.responseText);
    if (request.target.kind === "item" && request.operation === "remove" && execution.accepted) setSelected(null);
  };

  const moveSelected = (x: number, y: number) => {
    if (selected?.kind !== "item") return;
    operate({ operation: "move", target: selected, placement: { x, y } });
  };

  const statusOperationButtons = (target: OperationTarget, operations: InventoryOperation[]) => <div className="operation-buttons">
    {operations.map((operation) => <button type="button" key={operation}
      onClick={() => operate({ operation, target })}>[{operation.toUpperCase()}]</button>)}
  </div>;

  return <section className="inventory-surface" aria-label="Inventory" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>INVENTORY / STATUS</span><button type="button" onClick={onClose}>[X]</button></header>
    <div className="status-readout">
      {snapshot.variables.filter((item) => item.showInStatus).map((definition) => {
        const content = <><span>{definition.label}</span><strong>{String(state.values[definition.key] ?? "")}</strong></>;
        return definition.interactable ? <button type="button" key={definition.id} aria-pressed={selected?.kind === "variable" && selected.id === definition.id}
          onClick={() => setSelected({ kind: "variable", id: definition.id })}>{content}</button> : <div key={definition.id}>{content}</div>;
      })}
      {snapshot.computedValues.filter((item) => item.showInStatus).map((definition) => {
        const value = readComputedValue(definition, snapshot, state, now);
        const formatted = typeof value === "number" && definition.format === "integer"
          ? String(Math.round(value))
          : typeof value === "number" && definition.format === "seconds"
            ? `${Math.round(value)}s`
            : String(value);
        const content = <><span>{definition.label}</span><strong>{formatted}</strong></>;
        return definition.interactable ? <button type="button" key={definition.id} aria-pressed={selected?.kind === "computed" && selected.id === definition.id}
          onClick={() => setSelected({ kind: "computed", id: definition.id })}>{content}</button> : <div key={definition.id}>{content}</div>;
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
          if (instanceId) operate({ operation: "move", target: { kind: "item", id: instanceId }, placement: { x, y } });
        }}>
        {Array.from({ length: INVENTORY_COLUMNS * INVENTORY_ROWS }, (_, index) => {
          const x = index % INVENTORY_COLUMNS;
          const y = Math.floor(index / INVENTORY_COLUMNS);
          return <button type="button" className="inventory-cell" key={index} aria-label={`Inventory cell ${x + 1}, ${y + 1}`} onClick={() => moveSelected(x, y)} />;
        })}
        {state.inventory.map((entry) => {
          const item = snapshot.items.find((candidate) => candidate.id === entry.itemId);
          if (!item) return null;
          const moveEnabled = (item.interactable ?? true) && (item.operations ?? ["inspect", "use", "move", "remove"]).includes("move");
          return <button type="button" draggable={moveEnabled} className={`inventory-item${selected?.kind === "item" && selected.id === entry.instanceId ? " selected" : ""}`} key={entry.instanceId}
            style={{ "--x": entry.x, "--y": entry.y, "--w": item.width, "--h": item.height } as CSSProperties}
            onDragStart={(event) => event.dataTransfer.setData("text/pre-programmed-instance", entry.instanceId)}
            onClick={(event) => { event.stopPropagation(); if (item.interactable ?? true) setSelected({ kind: "item", id: entry.instanceId }); }}>
            {item.assetPath ? <img src={assetUrl(item.assetPath)} alt="" draggable={false} /> : <span>{item.name.slice(0, 3).toUpperCase()}</span>}
            {entry.quantity > 1 ? <b>{entry.quantity}</b> : null}
          </button>;
        })}
      </div>
      <aside className="inventory-inspector">
        {selectedEntry && selectedItem ? <>
          <strong>{selectedItem.name}</strong><p>{selectedItem.description}</p>
          {statusOperationButtons({ kind: "item", id: selectedEntry.instanceId }, selectedItem.operations ?? ["inspect", "use", "move", "remove"])}
          {authorMode ? <button type="button" onClick={() => onEditItem(selectedItem)}>[EDIT DEFINITION]</button> : null}
        </> : selectedVariable ? <>
          <strong>{selectedVariable.label}</strong><p>{String(state.values[selectedVariable.key] ?? "")}</p>
          {statusOperationButtons({ kind: "variable", id: selectedVariable.id }, selectedVariable.operations ?? [])}
        </> : selectedComputed ? <>
          <strong>{selectedComputed.label}</strong><p>{String(readComputedValue(selectedComputed, snapshot, state, now))}</p>
          {statusOperationButtons({ kind: "computed", id: selectedComputed.id }, selectedComputed.operations ?? [])}
        </> : <p>Tap an item or interactive status line. Tap a grid cell to move a selected item; desktop also supports drag.</p>}
      </aside>
    </div>
    {authorMode ? <details className="inventory-authoring">
      <summary>[DEFAULT INVENTORY + ITEM DEFINITIONS]</summary>
      <p className="muted">Starting quantity controls what a new playthrough contains. “Add now” changes only this test run.</p>
      <div className="inventory-definition-list">
        {snapshot.items.map((item) => <div key={item.id}>
          <span><strong>{item.name}</strong></span>
          <span><button type="button" aria-label={`Decrease starting ${item.name}`} onClick={() => void onSave([{ type: "item.upsert", item: { ...item, startingQuantity: Math.max(0, (item.startingQuantity ?? 0) - 1) } }], `Changed starting ${item.name}`)}>[-]</button> {item.startingQuantity ?? 0} <button type="button" aria-label={`Increase starting ${item.name}`} onClick={() => void onSave([{ type: "item.upsert", item: { ...item, startingQuantity: (item.startingQuantity ?? 0) + 1 } }], `Changed starting ${item.name}`)}>[+]</button> <button type="button" onClick={() => onState(addInventoryItem(snapshot, state, item.id, 1))}>[ADD NOW]</button> <button type="button" onClick={() => onEditItem(item)}>[EDIT]</button></span>
        </div>)}
        {!snapshot.items.length ? <span className="muted">No item definitions yet.</span> : null}
      </div>
      <div className="author-actions"><button type="button" onClick={onCreateItem}>[+ DEFAULT ITEM]</button></div>
    </details> : null}
  </section>;
}

function emptyItem(): ItemDefinition {
  return {
    id: crypto.randomUUID(), key: "", name: "", description: "", assetPath: "", width: 1, height: 1,
    stackable: false, maxStack: 1, removable: true, startingQuantity: 1,
    interactable: true, operations: ["inspect", "use", "move", "remove"], tags: [], initialState: {}, hooks: [],
  };
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
      <label>STARTING QUANTITY <input type="number" min={0} step={1} value={draft.startingQuantity ?? 0} onChange={(event) => setDraft({ ...draft, startingQuantity: Math.max(0, Math.floor(Number(event.target.value))) })} /><small>Items placed in every new playthrough by default.</small></label>
      <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
    </div>
    <OperationHooksEditor snapshot={snapshot} capability={{ interactable: draft.interactable ?? true, operations: draft.operations ?? ["inspect", "use", "move", "remove"], hooks: draft.hooks ?? [] }}
      onChange={(capability) => setDraft({ ...draft, ...capability })} />
    <div className="author-actions"><button type="button" disabled={saving} onClick={() => void save()}>[SAVE]</button><button type="button" onClick={onCancel}>[CANCEL]</button></div>
  </section>;
}
