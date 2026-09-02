import { useState, type CSSProperties } from "react";
import { configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import type { EffectEvent } from "../../../engine/rules/effectRuntime";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import type { OperationTarget } from "../../operations/model";
import { executeOperation, formatOperationOutput, type OperationRequest } from "../../operations/runtime";
import { itemLayout } from "../runtime";
import "./inventory.css";

export function Inventory({ snapshot, state, onState, onOutput, onEvents }: {
  snapshot: ProjectSnapshot;
  state: PlayState;
  onState: (state: PlayState) => void;
  onOutput: (text: string) => void;
  onEvents: (events: EffectEvent[]) => void;
}) {
  const [selected, setSelected] = useState<OperationTarget | null>(null);
  const selectedEntry = selected?.kind === "item" ? state.inventory.find((entry) => entry.instanceId === selected.id) : undefined;
  const selectedItem = snapshot.items.find((item) => item.id === selectedEntry?.itemId);

  const operate = (request: OperationRequest) => {
    const execution = executeOperation(snapshot, state, request);
    const output = formatOperationOutput(execution, state);
    onEvents(execution.events);
    if (output) onOutput(output);
    onState(execution.state);
    if (request.operation === "remove" && execution.accepted) setSelected(null);
  };

  const itemButton = (entry: PlayState["inventory"][number], style?: CSSProperties) => {
    const item = snapshot.items.find((candidate) => candidate.id === entry.itemId);
    if (!item) return null;
    const asset = item.assetId ? configuredAssetStore.resolve(snapshot, item.assetId) : null;
    return <button
      type="button"
      className={`inventory-item${selected?.id === entry.instanceId ? " is-selected" : ""}`}
      style={style}
      key={entry.instanceId}
      onClick={() => setSelected({ kind: "item", id: entry.instanceId })}
    >
      {asset?.url ? <img src={asset.url} alt="" /> : null}
      <span>{item.name || item.key}</span>
      {entry.quantity > 1 ? <small>×{entry.quantity}</small> : null}
    </button>;
  };

  const outsideGrid = snapshot.inventoryPresentation.mode === "grid"
    ? state.inventory.filter((entry) => !state.inventoryPositions[entry.instanceId])
    : [];

  return <div className="inventory-player-surface">
    <div className="inventory-primary-container">
      {snapshot.inventoryPresentation.mode === "grid" ? <>
        <div
          className="inventory-grid-v2"
          style={{ "--inventory-columns": snapshot.inventoryPresentation.columns, "--inventory-rows": snapshot.inventoryPresentation.rows } as CSSProperties}
        >
          {Array.from({ length: snapshot.inventoryPresentation.columns * snapshot.inventoryPresentation.rows }, (_, index) => {
            const x = index % snapshot.inventoryPresentation.columns;
            const y = Math.floor(index / snapshot.inventoryPresentation.columns);
            return <button type="button" className="inventory-cell" key={`${x}:${y}`} aria-label={`Inventory cell ${x + 1}, ${y + 1}`} onClick={() => {
              if (selected?.kind === "item") operate({ operation: "move", target: selected, placement: { x, y } });
            }} />;
          })}
          {state.inventory.map((entry) => {
            const position = state.inventoryPositions[entry.instanceId];
            if (!position) return null;
            const layout = itemLayout(snapshot, entry.itemId);
            return itemButton(entry, { gridColumn: `${position.x + 1} / span ${layout.width}`, gridRow: `${position.y + 1} / span ${layout.height}` });
          })}
        </div>
        {outsideGrid.length ? <div className="inventory-outside-grid">
          <small>CARRIED OUTSIDE THE GRID</small>
          {outsideGrid.map((entry) => itemButton(entry))}
        </div> : null}
      </> : <div className="inventory-list-v2">{state.inventory.map((entry) => itemButton(entry))}</div>}
    </div>

    {selectedItem && selectedEntry ? <aside className="inventory-inspector-v2">
      <strong>{selectedItem.name || selectedItem.key}</strong>
      {selectedItem.description ? <p>{selectedItem.description}</p> : null}
      <div className="operation-buttons">
        {(selectedItem.operations ?? []).filter((operation) => operation !== "move").map((operation) => <button type="button" key={operation} onClick={() => operate({ operation, target: { kind: "item", id: selectedEntry.instanceId } })}>[{operation.toUpperCase()}]</button>)}
      </div>
      {snapshot.inventoryPresentation.mode === "grid" ? <small>To move this item, tap its destination cell.</small> : null}
    </aside> : <aside className="inventory-inspector-v2"><small>Select an item to inspect or use it.</small></aside>}
  </div>;
}
