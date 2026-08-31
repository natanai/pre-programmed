import { useEffect, useState, type CSSProperties } from "react";
import { assetUrl } from "../../../data/assets";
import { type EffectEvent } from "../../../game/effects";
import {
  addInventoryItem,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
} from "../../../game/inventory";
import type {
  InventoryOperation,
  ItemDefinition,
  MutationOperation,
  OperationTarget,
  PlayState,
  ProjectSnapshot,
} from "../../../game/model";
import { executeOperation, formatOperationOutput, type OperationRequest } from "../../../game/operations";
import { readComputedValue } from "../../../game/runtimeValues";
import "../author/inventoryAuthor.css";

type InventoryScreen = "play" | "definitions";

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
  onClose: _onClose,
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
  const [screen, setScreen] = useState<InventoryScreen>("play");
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
    const output = formatOperationOutput(execution, state);
    onEvents(execution.events);
    if (output) onOutput(output);
    onState(execution.state);
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

  if (screen === "definitions" && authorMode) return <section className="inventory-surface inventory-definition-workspace" aria-label="Item definitions" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>ITEM DEFINITIONS</span></header>
    <div className="inventory-definition-workspace-body">
      <button type="button" className="inventory-definition-back" onClick={() => setScreen("play")}>[← BACK TO INVENTORY]</button>
      <div className="inventory-definition-help">Default quantity is added to every new playthrough. “Add to this run” changes only the current play state.</div>
      <div className="inventory-definition-cards">
        {snapshot.items.map((item) => <article className="inventory-definition-card" key={item.id}>
          <button type="button" className="inventory-definition-open" onClick={() => onEditItem(item)}>
            <span><strong>{item.name}</strong><small>{item.key || "no key"}</small></span><span aria-hidden="true">›</span>
          </button>
          <div className="inventory-definition-actions">
            <span>DEFAULT</span>
            <button type="button" aria-label={`Decrease starting ${item.name}`} onClick={() => void onSave([
              { type: "item.upsert", item: { ...item, startingQuantity: Math.max(0, (item.startingQuantity ?? 0) - 1) } },
            ], `Changed starting ${item.name}`)}>[-]</button>
            <strong>{item.startingQuantity ?? 0}</strong>
            <button type="button" aria-label={`Increase starting ${item.name}`} onClick={() => void onSave([
              { type: "item.upsert", item: { ...item, startingQuantity: (item.startingQuantity ?? 0) + 1 } },
            ], `Changed starting ${item.name}`)}>[+]</button>
            <button type="button" className="inventory-add-current" onClick={() => onState(addInventoryItem(snapshot, state, item.id, 1))}>[ADD TO THIS RUN]</button>
          </div>
        </article>)}
        {!snapshot.items.length ? <div className="inventory-definition-empty">No item definitions yet.</div> : null}
      </div>
      <button type="button" className="inventory-create-definition" onClick={onCreateItem}>[+ ITEM DEFINITION]</button>
    </div>
  </section>;

  return <section className="inventory-surface" aria-label="Inventory" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>INVENTORY / STATUS</span></header>
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
    {authorMode ? <div className="inventory-author-actions">
      <button type="button" onClick={() => setScreen("definitions")}>[ITEM DEFINITIONS]</button>
      <button type="button" onClick={onCreateItem}>[+ ITEM]</button>
    </div> : null}
  </section>;
}
