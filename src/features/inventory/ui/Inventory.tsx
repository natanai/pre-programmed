import { useState, type CSSProperties } from "react";
import { configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import type { EffectEvent } from "../../../engine/rules/effectRuntime";
import {
  compatibleBodySlots,
  entryOccupiesInventoryGrid,
  equipmentAssignmentForSlot,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  occupiedEquipmentSlotKeys,
} from "../runtime";
import { bodySlotPercentRect, DEFAULT_BODY_CANVAS, normalizeBodyTypeDefinition } from "../bodyCanvas";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import type { OperationId, OperationTarget } from "../../operations/model";
import { executeOperation, formatOperationOutput, type OperationRequest } from "../../operations/runtime";
import { BodyDiagram } from "./BodyDiagram";
import "../author/inventoryAuthor.css";

const DEFAULT_ITEM_OPERATIONS: OperationId[] = ["inspect", "use", "move", "remove", "equip", "unequip"];

/**
 * Inventory's live player surface owns carried items, the grid, body slots, and
 * equipment interaction. Optional edit callbacks are supplied only by the
 * Author experience so the same live surface can become directly editable
 * without turning player navigation into an Author task.
 */
export function Inventory({
  snapshot,
  state,
  onState,
  onOutput,
  onEvents,
  onEditItem,
  onEditBodyType,
}: {
  snapshot: ProjectSnapshot;
  state: PlayState;
  onState: (state: PlayState) => void;
  onOutput: (text: string) => void;
  onEvents: (events: EffectEvent[]) => void;
  onEditItem?: (itemId: string) => void;
  onEditBodyType?: (bodyTypeId: string) => void;
}) {
  const [selected, setSelected] = useState<OperationTarget | null>(null);
  const assetUrlFor = (assetId: string | undefined | null) => assetId
    ? configuredAssetStore.resolve(snapshot, assetId)?.url ?? ""
    : "";

  const bodyTypes = snapshot.bodyBackgrounds ?? [];
  const selectedEntry = selected?.kind === "item" ? state.inventory.find((entry) => entry.instanceId === selected.id) : undefined;
  const selectedItem = snapshot.items.find((item) => item.id === selectedEntry?.itemId);
  const activeBodySource = bodyTypes.find((bodyType) => bodyType.id === state.bodyBackgroundId);
  const activeBodyType = activeBodySource ? normalizeBodyTypeDefinition(activeBodySource) : undefined;
  const activeSlots = activeBodyType?.slots ?? [];
  const bodySlotName = (key: string) => activeSlots.find((slot) => slot.key === key)?.name ?? key;

  const operate = (request: OperationRequest) => {
    const execution = executeOperation(snapshot, state, request);
    const output = formatOperationOutput(execution, state);
    onEvents(execution.events);
    if (output) onOutput(output);
    onState(execution.state);
    if (request.target.kind === "item" && request.operation === "remove" && execution.accepted) setSelected(null);
  };

  const equipToSlot = (instanceId: string, slotKey: string) => operate({
    operation: "equip",
    target: { kind: "item", id: instanceId },
    arguments: { slot: { kind: "text", value: slotKey } },
  });

  const moveSelected = (x: number, y: number) => {
    if (selected?.kind !== "item") return;
    operate({ operation: "move", target: selected, placement: { x, y } });
  };

  const operationButtons = (target: OperationTarget, operations: OperationId[]) => <div className="operation-buttons">
    {operations.map((operation) => <button type="button" key={operation}
      onClick={() => operate({ operation, target })}>[{operation.toUpperCase()}]</button>)}
  </div>;

  const selectedItemOperations = selectedItem?.operations ?? DEFAULT_ITEM_OPERATIONS;
  const compatibleSlots = selectedItem ? compatibleBodySlots(snapshot, state, selectedItem) : [];
  const equippedAnchor = selectedEntry?.equipment
    ? activeSlots.find((slot) => slot.key === selectedEntry.equipment?.anchorSlotKey)
    : undefined;
  const selectedOccupiedNames = selectedEntry?.equipment
    ? selectedEntry.equipment.occupiedSlotKeys.map(bodySlotName)
    : [];
  const bodyCanvas = activeBodyType?.canvas ?? { ...DEFAULT_BODY_CANVAS };
  const diagramSlots = activeSlots.map((slot) => {
    const equippedEntry = state.inventory.find((entry) => entry.equipment?.occupiedSlotKeys.includes(slot.key));
    const equippedItem = snapshot.items.find((item) => item.id === equippedEntry?.itemId);
    const anchor = equippedEntry?.equipment?.anchorSlotKey === slot.key;
    const selectedCanEquip = Boolean(
      selectedEntry
      && selectedItem
      && selectedItemOperations.includes("equip")
      && compatibleSlots.some((candidate) => candidate.key === slot.key),
    );
    return {
      slot,
      occupied: Boolean(equippedEntry),
      canEquip: selectedCanEquip,
      imageUrl: anchor ? assetUrlFor(equippedItem?.assetId) : "",
      abbreviation: anchor ? equippedItem?.name.slice(0, 3).toUpperCase() : equippedItem ? "USED" : undefined,
      equippedEntry,
      equippedItem,
      selectedCanEquip,
      anchor,
    };
  });

  return <div className="inventory-play-workspace" aria-label="Inventory">
    <div className="inventory-layout">
      <div className="inventory-primary-area">
        <aside className={`inventory-inspector${selected ? " has-selection" : ""}`} aria-label="Selected inventory details">
          {selectedEntry && selectedItem ? <>
            <div className="inventory-inspector-heading">
              <strong>{selectedItem.name}</strong>
              <div className="inventory-inspector-heading-actions">
                {onEditItem ? <button type="button" onClick={() => onEditItem(selectedItem.id)}>[EDIT]</button> : null}
                <button type="button" onClick={() => setSelected(null)}>[DONE]</button>
              </div>
            </div>
            <p>{selectedItem.description}</p>
            {equippedAnchor ? <p className="inventory-equipped-status">
              EQUIPPED · {equippedAnchor.name}{selectedOccupiedNames.length > 1 ? ` · OCCUPIES ${selectedOccupiedNames.join(" + ")}` : ""}
            </p> : null}
            {operationButtons(
              { kind: "item", id: selectedEntry.instanceId },
              selectedItemOperations.filter((operation) => operation !== "equip" && operation !== "unequip"),
            )}
            {selectedItemOperations.includes("equip") ? <div className="inventory-equip-choices">
              <span>EQUIP PLACEMENT</span>
              {compatibleSlots.map((slot) => {
                const assignment = equipmentAssignmentForSlot(snapshot, state, selectedItem, slot.key);
                const additional = assignment?.occupiedSlotKeys.filter((key) => key !== slot.key).map(bodySlotName) ?? [];
                return <button
                  type="button"
                  key={slot.id}
                  aria-pressed={selectedEntry.equipment?.anchorSlotKey === slot.key}
                  onClick={() => equipToSlot(selectedEntry.instanceId, slot.key)}
                >[{slot.name.toUpperCase()}{additional.length ? ` + ${additional.map((name) => name.toUpperCase()).join(" + ")}` : ""}]</button>;
              })}
              {!compatibleSlots.length ? <small>NO COMPLETE PLACEMENT FITS THIS BODY TYPE.</small> : null}
            </div> : null}
            {selectedItemOperations.includes("unequip") && selectedEntry.equipment ? <button type="button" onClick={() => operate({ operation: "unequip", target: { kind: "item", id: selectedEntry.instanceId } })}>[UNEQUIP]</button> : null}
          </> : <p className="inventory-inspector-help">Tap an item for details. Tap a grid cell to move a selected item; desktop also supports drag.</p>}
        </aside>

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
          {state.inventory.filter((entry) => entryOccupiesInventoryGrid(snapshot, entry)).map((entry) => {
            const item = snapshot.items.find((candidate) => candidate.id === entry.itemId);
            if (!item) return null;
            const moveEnabled = (item.interactable ?? true) && (item.operations ?? DEFAULT_ITEM_OPERATIONS).includes("move");
            return <button type="button" draggable={moveEnabled} className={`inventory-item${selected?.kind === "item" && selected.id === entry.instanceId ? " selected" : ""}${entry.equipment ? " equipped" : ""}`} key={entry.instanceId}
              style={{ "--x": entry.x, "--y": entry.y, "--w": item.width, "--h": item.height } as CSSProperties}
              onDragStart={(event) => event.dataTransfer.setData("text/pre-programmed-instance", entry.instanceId)}
              onClick={(event) => { event.stopPropagation(); if (item.interactable ?? true) setSelected({ kind: "item", id: entry.instanceId }); }}>
              {assetUrlFor(item.assetId) ? <img src={assetUrlFor(item.assetId)} alt="" draggable={false} /> : <span>{item.name.slice(0, 3).toUpperCase()}</span>}
              {entry.quantity > 1 ? <b>{entry.quantity}</b> : null}
              {entry.equipment ? <i aria-label={`Equipped; occupies ${occupiedEquipmentSlotKeys(entry).map(bodySlotName).join(", ")}`}>E</i> : null}
            </button>;
          })}
        </div>
      </div>

      <section className="inventory-body-area" aria-label="Body equipment area">
        <div className="inventory-body-heading">
          <span>BODY</span>
          <div className="inventory-body-heading-actions">
            <small>{activeBodyType?.name ?? "NO BODY TYPE"}</small>
            {activeBodyType && onEditBodyType ? <button type="button" onClick={() => onEditBodyType(activeBodyType.id)}>[EDIT]</button> : null}
          </div>
        </div>
        <BodyDiagram
          canvas={bodyCanvas}
          backgroundUrl={assetUrlFor(activeBodyType?.assetId)}
          emptyText={bodyTypes.length ? "NO ACTIVE BODY IMAGE" : "BODY TYPE NOT CONFIGURED"}
          slots={diagramSlots}
        >
          <div className="body-diagram-hit-layer">
            {diagramSlots.map(({ slot, equippedEntry, equippedItem, selectedCanEquip, anchor }) => {
              const rect = bodySlotPercentRect(slot, bodyCanvas);
              return <button
                type="button"
                key={slot.id}
                style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
                aria-label={equippedItem ? `${slot.name}: ${anchor ? equippedItem.name : `occupied by ${equippedItem.name}`}` : `${slot.name}: empty`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const instanceId = event.dataTransfer.getData("text/pre-programmed-instance");
                  if (instanceId) equipToSlot(instanceId, slot.key);
                }}
                onClick={() => {
                  if (equippedEntry) {
                    setSelected({ kind: "item", id: equippedEntry.instanceId });
                    return;
                  }
                  if (selectedEntry && selectedCanEquip) equipToSlot(selectedEntry.instanceId, slot.key);
                }}
              />;
            })}
          </div>
        </BodyDiagram>
      </section>
    </div>
  </div>;
}
