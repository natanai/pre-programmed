import { useEffect, useState, type CSSProperties } from "react";
import { assetUrl } from "../../../data/assets";
import { type EffectEvent } from "../../../game/effects";
import {
  addInventoryItem,
  compatibleBodySlots,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  itemCanEquipToSlot,
  reconcileEquippedItems,
} from "../../../game/inventory";
import type {
  BodyBackgroundDefinition,
  ItemDefinition,
  MutationOperation,
  OperationId,
  OperationTarget,
  PlayState,
  ProjectSnapshot,
} from "../../../game/model";
import { executeOperation, formatOperationOutput, type OperationRequest } from "../../../game/operations";
import { readComputedValue } from "../../../game/runtimeValues";
import "../author/inventoryAuthor.css";

type InventoryScreen = "play" | "definitions" | "body-types";
const DEFAULT_ITEM_OPERATIONS: OperationId[] = ["inspect", "use", "move", "remove", "equip", "unequip"];

export function Inventory({
  snapshot,
  state,
  authorMode,
  onState,
  onOutput,
  onEvents,
  onEditItem,
  onCreateItem,
  onEditBodyBackground,
  onCreateBodyBackground,
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
  onEditBodyBackground: (background: BodyBackgroundDefinition) => void;
  onCreateBodyBackground: () => void;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<OperationTarget | null>(null);
  const [screen, setScreen] = useState<InventoryScreen>("play");
  const [definitionQuery, setDefinitionQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const bodyTypes = snapshot.bodyBackgrounds ?? [];
  const selectedEntry = selected?.kind === "item" ? state.inventory.find((entry) => entry.instanceId === selected.id) : undefined;
  const selectedItem = snapshot.items.find((item) => item.id === selectedEntry?.itemId);
  const selectedVariable = selected?.kind === "variable" ? snapshot.variables.find((item) => item.id === selected.id) : undefined;
  const selectedComputed = selected?.kind === "computed" ? snapshot.computedValues.find((item) => item.id === selected.id) : undefined;
  const activeBodyType = bodyTypes.find((bodyType) => bodyType.id === state.bodyBackgroundId);
  const normalizedDefinitionQuery = definitionQuery.trim().toLowerCase();
  const visibleDefinitions = snapshot.items.filter((item) => !normalizedDefinitionQuery || [
    item.name,
    item.key,
    item.description,
    item.tags.join(" "),
  ].some((value) => value.toLowerCase().includes(normalizedDefinitionQuery)));

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

  const statusOperationButtons = (target: OperationTarget, operations: OperationId[]) => <div className="operation-buttons">
    {operations.map((operation) => <button type="button" key={operation}
      onClick={() => operate({ operation, target })}>[{operation.toUpperCase()}]</button>)}
  </div>;

  if (screen === "definitions" && authorMode) return <section className="inventory-surface inventory-definition-workspace" aria-label="Item definitions" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>ITEM DEFINITIONS</span></header>
    <div className="inventory-definition-controls">
      <button type="button" className="inventory-definition-back" onClick={() => setScreen("play")}>[← INVENTORY]</button>
      <div className="inventory-definition-help">Default quantity is added to every new playthrough. “Add to this run” changes only the current play state.</div>
      <div className="inventory-definition-search-row">
        <label htmlFor="inventory-definition-search">FIND</label>
        <div className="inventory-definition-search-control">
          <input
            id="inventory-definition-search"
            type="search"
            value={definitionQuery}
            placeholder="item name, key, or tag"
            onChange={(event) => setDefinitionQuery(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <span aria-live="polite">{normalizedDefinitionQuery ? `${visibleDefinitions.length}/${snapshot.items.length}` : snapshot.items.length}</span>
          {definitionQuery ? <button type="button" aria-label="Clear item search" onClick={() => setDefinitionQuery("")}>[X]</button> : null}
        </div>
      </div>
    </div>
    <div className="inventory-definition-scroll">
      {visibleDefinitions.length ? <div className="inventory-definition-cards">
        {visibleDefinitions.map((item) => <article className="inventory-definition-card" key={item.id}>
          <button type="button" className="inventory-definition-open" onClick={() => onEditItem(item)}>
            <span><strong>{item.name || item.key || "Untitled item"}</strong><small>{item.key || "no key"}</small></span><span aria-hidden="true">›</span>
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
      </div> : <div className="inventory-definition-empty">{normalizedDefinitionQuery ? "NO MATCHING ITEM DEFINITIONS." : "NO ITEM DEFINITIONS YET."}</div>}
    </div>
    <div className="inventory-definition-footer">
      <button type="button" className="inventory-create-definition" onClick={onCreateItem}>[+ ITEM DEFINITION]</button>
    </div>
  </section>;

  if (screen === "body-types" && authorMode) return <section className="inventory-surface inventory-definition-workspace" aria-label="Body types" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>BODY TYPES</span></header>
    <div className="inventory-definition-controls">
      <button type="button" className="inventory-definition-back" onClick={() => setScreen("play")}>[← INVENTORY]</button>
      <div className="inventory-definition-help">Each body type owns its background and slot layout. Triggers can switch the active body type during play; matching slot keys preserve equipment across the change.</div>
      <label className="body-background-starting">STARTING BODY TYPE
        <select value={snapshot.startingBodyBackgroundId ?? ""} onChange={(event) => void onSave([
          { type: "bodyBackground.starting", id: event.target.value || null },
        ], "Changed starting body type")}>
          <option value="">none</option>
          {bodyTypes.map((bodyType) => <option value={bodyType.id} key={bodyType.id}>{bodyType.name}</option>)}
        </select>
      </label>
    </div>
    <div className="inventory-definition-scroll">
      {bodyTypes.length ? <div className="inventory-body-background-cards">
        {bodyTypes.map((bodyType) => <article className="inventory-body-background-card" key={bodyType.id}>
          <button type="button" className="inventory-body-background-preview-button" onClick={() => onEditBodyBackground(bodyType)}>
            <span className="inventory-body-background-thumbnail" style={bodyType.assetPath ? {
              backgroundImage: `url("${assetUrl(bodyType.assetPath)}")`,
            } : undefined} aria-hidden="true" />
            <span><strong>{bodyType.name}</strong><small>{bodyType.id === snapshot.startingBodyBackgroundId ? `starting · ${(bodyType.slots ?? []).length} slots` : `${(bodyType.slots ?? []).length} slots`}</small></span>
            <span aria-hidden="true">›</span>
          </button>
          <div className="inventory-definition-actions">
            <button type="button" onClick={() => onState(reconcileEquippedItems(snapshot, { ...state, bodyBackgroundId: bodyType.id }))}>[USE THIS RUN]</button>
          </div>
        </article>)}
      </div> : <div className="inventory-definition-empty">NO BODY TYPES YET. A BODY TYPE CAN REPRESENT BABY, CHILD, ADULT, A TRANSFORMATION, OR ANY OTHER SLOT LAYOUT YOUR GAME NEEDS.</div>}
    </div>
    <div className="inventory-definition-footer">
      <button type="button" className="inventory-create-definition" onClick={onCreateBodyBackground}>[+ BODY TYPE]</button>
    </div>
  </section>;

  const selectedItemOperations = selectedItem?.operations ?? DEFAULT_ITEM_OPERATIONS;
  const compatibleSlots = selectedItem ? compatibleBodySlots(snapshot, state, selectedItem) : [];
  const equippedSlot = selectedEntry?.equippedSlotKey
    ? (activeBodyType?.slots ?? []).find((slot) => slot.key === selectedEntry.equippedSlotKey)
    : undefined;

  return <section className="inventory-surface inventory-play-workspace" aria-label="Inventory" onPointerDown={(event) => event.stopPropagation()}>
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
      <div className="inventory-primary-area">
        <aside className={`inventory-inspector${selected ? " has-selection" : ""}`} aria-label="Selected inventory details">
          {selectedEntry && selectedItem ? <>
            <div className="inventory-inspector-heading"><strong>{selectedItem.name}</strong><button type="button" onClick={() => setSelected(null)}>[DONE]</button></div>
            <p>{selectedItem.description}</p>
            {equippedSlot ? <p className="inventory-equipped-status">EQUIPPED · {equippedSlot.name}</p> : null}
            {statusOperationButtons(
              { kind: "item", id: selectedEntry.instanceId },
              selectedItemOperations.filter((operation) => operation !== "equip" && operation !== "unequip"),
            )}
            {selectedItemOperations.includes("equip") ? <div className="inventory-equip-choices">
              <span>EQUIP TO</span>
              {compatibleSlots.map((slot) => <button
                type="button"
                key={slot.id}
                aria-pressed={selectedEntry.equippedSlotKey === slot.key}
                onClick={() => equipToSlot(selectedEntry.instanceId, slot.key)}
              >[{slot.name.toUpperCase()}]</button>)}
              {!compatibleSlots.length ? <small>NO COMPATIBLE SLOTS ON THIS BODY TYPE.</small> : null}
            </div> : null}
            {selectedItemOperations.includes("unequip") && selectedEntry.equippedSlotKey ? <button type="button" onClick={() => operate({ operation: "unequip", target: { kind: "item", id: selectedEntry.instanceId } })}>[UNEQUIP]</button> : null}
            {authorMode ? <button type="button" onClick={() => onEditItem(selectedItem)}>[EDIT DEFINITION]</button> : null}
          </> : selectedVariable ? <>
            <div className="inventory-inspector-heading"><strong>{selectedVariable.label}</strong><button type="button" onClick={() => setSelected(null)}>[DONE]</button></div>
            <p>{String(state.values[selectedVariable.key] ?? "")}</p>
            {statusOperationButtons({ kind: "variable", id: selectedVariable.id }, selectedVariable.operations ?? [])}
          </> : selectedComputed ? <>
            <div className="inventory-inspector-heading"><strong>{selectedComputed.label}</strong><button type="button" onClick={() => setSelected(null)}>[DONE]</button></div>
            <p>{String(readComputedValue(selectedComputed, snapshot, state, now))}</p>
            {statusOperationButtons({ kind: "computed", id: selectedComputed.id }, selectedComputed.operations ?? [])}
          </> : <p className="inventory-inspector-help">Tap an item or interactive status line. Tap a grid cell to move a selected item; desktop also supports drag.</p>}
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
          {state.inventory.map((entry) => {
            const item = snapshot.items.find((candidate) => candidate.id === entry.itemId);
            if (!item) return null;
            const moveEnabled = (item.interactable ?? true) && (item.operations ?? DEFAULT_ITEM_OPERATIONS).includes("move");
            return <button type="button" draggable={moveEnabled} className={`inventory-item${selected?.kind === "item" && selected.id === entry.instanceId ? " selected" : ""}${entry.equippedSlotKey ? " equipped" : ""}`} key={entry.instanceId}
              style={{ "--x": entry.x, "--y": entry.y, "--w": item.width, "--h": item.height } as CSSProperties}
              onDragStart={(event) => event.dataTransfer.setData("text/pre-programmed-instance", entry.instanceId)}
              onClick={(event) => { event.stopPropagation(); if (item.interactable ?? true) setSelected({ kind: "item", id: entry.instanceId }); }}>
              {item.assetPath ? <img src={assetUrl(item.assetPath)} alt="" draggable={false} /> : <span>{item.name.slice(0, 3).toUpperCase()}</span>}
              {entry.quantity > 1 ? <b>{entry.quantity}</b> : null}
              {entry.equippedSlotKey ? <i aria-label={`Equipped to ${entry.equippedSlotKey}`}>E</i> : null}
            </button>;
          })}
        </div>
      </div>

      <section className="inventory-body-area" aria-label="Body equipment area">
        <div className="inventory-body-heading"><span>BODY</span><small>{activeBodyType?.name ?? "NO BODY TYPE"}</small></div>
        <div
          className={`inventory-body-canvas${activeBodyType?.assetPath ? " has-background" : ""}`}
          style={activeBodyType?.assetPath ? { backgroundImage: `url("${assetUrl(activeBodyType.assetPath)}")` } : undefined}
        >
          {!activeBodyType?.assetPath ? <span>{bodyTypes.length ? "NO ACTIVE BODY IMAGE" : "BODY TYPE NOT CONFIGURED"}</span> : null}
          {(activeBodyType?.slots ?? []).map((slot) => {
            const equippedEntry = state.inventory.find((entry) => entry.equippedSlotKey === slot.key);
            const equippedItem = snapshot.items.find((item) => item.id === equippedEntry?.itemId);
            const selectedCanEquip = Boolean(
              selectedEntry
              && selectedItem
              && selectedItemOperations.includes("equip")
              && itemCanEquipToSlot(selectedItem, slot),
            );
            return <button
              type="button"
              className={`inventory-body-slot${equippedEntry ? " occupied" : ""}${selectedCanEquip ? " can-equip" : ""}`}
              key={slot.id}
              style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` }}
              aria-label={equippedItem ? `${slot.name}: ${equippedItem.name}` : `${slot.name}: empty`}
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
            >
              {equippedItem?.assetPath ? <img src={assetUrl(equippedItem.assetPath)} alt="" draggable={false} /> : equippedItem ? <strong>{equippedItem.name.slice(0, 3).toUpperCase()}</strong> : null}
              <small>{slot.name}</small>
            </button>;
          })}
        </div>
      </section>
    </div>

    {authorMode ? <div className="inventory-author-actions">
      <button type="button" onClick={() => setScreen("definitions")}>[ITEM DEFINITIONS]</button>
      <button type="button" onClick={() => setScreen("body-types")}>[BODY TYPES]</button>
      <button type="button" onClick={onCreateItem}>[+ ITEM]</button>
    </div> : null}
  </section>;
}
