import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { BodySlotDefinition, InventoryEntry, ItemDefinition } from "./model";

export const INVENTORY_COLUMNS = 10;
export const INVENTORY_ROWS = 6;

function itemForEntry(snapshot: ProjectSnapshot, entry: InventoryEntry) {
  return snapshot.items.find((item) => item.id === entry.itemId);
}

export function entryOccupiesInventoryGrid(snapshot: ProjectSnapshot, entry: InventoryEntry) {
  const item = itemForEntry(snapshot, entry);
  return !entry.equippedSlotKey || item?.equippedStorage !== "slot";
}

export function activeBodyType(snapshot: ProjectSnapshot, state: PlayState) {
  return (snapshot.bodyBackgrounds ?? []).find((bodyType) => bodyType.id === state.bodyBackgroundId);
}

export function activeBodySlots(snapshot: ProjectSnapshot, state: PlayState): BodySlotDefinition[] {
  return activeBodyType(snapshot, state)?.slots ?? [];
}

export function itemCanEquipToSlot(item: ItemDefinition, slot: BodySlotDefinition) {
  const allowedKeys = item.equipmentSlotKeys ?? [];
  return allowedKeys.length === 0 || allowedKeys.includes(slot.key);
}

export function compatibleBodySlots(snapshot: ProjectSnapshot, state: PlayState, item: ItemDefinition) {
  return activeBodySlots(snapshot, state).filter((slot) => itemCanEquipToSlot(item, slot));
}

export function equipInventoryEntry(
  snapshot: ProjectSnapshot,
  state: PlayState,
  instanceId: string,
  slotKey: string,
): PlayState {
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
  const slot = activeBodySlots(snapshot, state).find((candidate) => candidate.key === slotKey);
  if (!entry || !item || !slot || !itemCanEquipToSlot(item, slot)) return state;
  const displaced = state.inventory.find((candidate) => candidate.instanceId !== instanceId && candidate.equippedSlotKey === slot.key);
  let inventory = state.inventory.map((candidate) => candidate.instanceId === instanceId
    ? { ...candidate, equippedSlotKey: slot.key }
    : candidate);

  if (displaced) {
    const displacedItem = itemForEntry(snapshot, displaced);
    if (!displacedItem) return state;
    let placement = { x: displaced.x, y: displaced.y };
    if (!canPlaceItem(snapshot, inventory, displacedItem, placement.x, placement.y, displaced.instanceId)) {
      const fallbackPlacement = findFirstPlacementInEntries(snapshot, inventory, displacedItem);
      if (!fallbackPlacement) return state;
      placement = fallbackPlacement;
    }
    inventory = inventory.map((candidate) => candidate.instanceId === displaced.instanceId
      ? { ...candidate, ...placement, equippedSlotKey: null }
      : candidate);
  }

  return { ...state, inventory };
}

export function unequipInventoryEntry(snapshot: ProjectSnapshot, state: PlayState, instanceId: string): PlayState {
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  if (!entry?.equippedSlotKey) return state;
  const item = itemForEntry(snapshot, entry);
  if (!item) return state;
  let placement = { x: entry.x, y: entry.y };
  if (!canPlaceItem(snapshot, state.inventory, item, placement.x, placement.y, entry.instanceId)) {
    const fallbackPlacement = findFirstPlacementInEntries(snapshot, state.inventory, item);
    if (!fallbackPlacement) return state;
    placement = fallbackPlacement;
  }
  return {
    ...state,
    inventory: state.inventory.map((candidate) => candidate.instanceId === instanceId
      ? { ...candidate, ...placement, equippedSlotKey: null }
      : candidate),
  };
}

/** Remove equipment assignments whose stable slot key no longer exists on the current body type. */
export function reconcileEquippedItems(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const slotKeys = new Set(activeBodySlots(snapshot, state).map((slot) => slot.key));
  let nextState = state;
  for (const entry of state.inventory ?? []) {
    if (entry.equippedSlotKey && !slotKeys.has(entry.equippedSlotKey)) {
      nextState = unequipInventoryEntry(snapshot, nextState, entry.instanceId);
    }
  }
  return nextState;
}

/** Change body type atomically; refuse if displaced slot-carried items cannot return to the grid. */
export function setActiveBodyType(snapshot: ProjectSnapshot, state: PlayState, bodyTypeId: string | null): PlayState {
  if (bodyTypeId && !(snapshot.bodyBackgrounds ?? []).some((bodyType) => bodyType.id === bodyTypeId)) return state;
  const candidate = reconcileEquippedItems(snapshot, { ...state, bodyBackgroundId: bodyTypeId });
  const validSlotKeys = new Set(activeBodySlots(snapshot, candidate).map((slot) => slot.key));
  const hasInvalidEquipment = candidate.inventory.some((entry) => entry.equippedSlotKey && !validSlotKeys.has(entry.equippedSlotKey));
  return hasInvalidEquipment ? state : candidate;
}

export function occupiedCells(
  snapshot: ProjectSnapshot,
  entries: InventoryEntry[],
  ignoreInstanceId?: string,
) {
  const occupied = new Set<string>();
  for (const entry of entries) {
    if (entry.instanceId === ignoreInstanceId) continue;
    if (!entryOccupiesInventoryGrid(snapshot, entry)) continue;
    const item = itemForEntry(snapshot, entry);
    if (!item) continue;
    for (let y = entry.y; y < entry.y + item.height; y += 1) {
      for (let x = entry.x; x < entry.x + item.width; x += 1) occupied.add(`${x}:${y}`);
    }
  }
  return occupied;
}

export function canPlaceItem(
  snapshot: ProjectSnapshot,
  entries: InventoryEntry[],
  item: ItemDefinition,
  x: number,
  y: number,
  ignoreInstanceId?: string,
) {
  if (x < 0 || y < 0 || x + item.width > INVENTORY_COLUMNS || y + item.height > INVENTORY_ROWS) {
    return false;
  }
  const occupied = occupiedCells(snapshot, entries, ignoreInstanceId);
  for (let cellY = y; cellY < y + item.height; cellY += 1) {
    for (let cellX = x; cellX < x + item.width; cellX += 1) {
      if (occupied.has(`${cellX}:${cellY}`)) return false;
    }
  }
  return true;
}

export function findFirstPlacement(snapshot: ProjectSnapshot, state: PlayState, item: ItemDefinition) {
  return findFirstPlacementInEntries(snapshot, state.inventory, item);
}

function findFirstPlacementInEntries(snapshot: ProjectSnapshot, entries: InventoryEntry[], item: ItemDefinition) {
  for (let y = 0; y < INVENTORY_ROWS; y += 1) {
    for (let x = 0; x < INVENTORY_COLUMNS; x += 1) {
      if (canPlaceItem(snapshot, entries, item, x, y)) return { x, y };
    }
  }
  return null;
}

export function addInventoryItem(
  snapshot: ProjectSnapshot,
  state: PlayState,
  itemId: string,
  quantity = 1,
): PlayState {
  const item = snapshot.items.find((candidate) => candidate.id === itemId);
  if (!item || quantity <= 0) return state;
  const inventory = state.inventory.map((entry) => ({ ...entry, state: { ...entry.state } }));
  let remaining = Math.floor(quantity);

  if (item.stackable) {
    for (const entry of inventory) {
      if (entry.itemId !== item.id || entry.equippedSlotKey || entry.quantity >= item.maxStack) continue;
      const accepted = Math.min(remaining, item.maxStack - entry.quantity);
      entry.quantity += accepted;
      remaining -= accepted;
      if (remaining === 0) return { ...state, inventory };
    }
  }

  while (remaining > 0) {
    const provisional = { ...state, inventory };
    const placement = findFirstPlacement(snapshot, provisional, item);
    if (!placement) break;
    const accepted = item.stackable ? Math.min(remaining, item.maxStack) : 1;
    inventory.push({
      instanceId: crypto.randomUUID(),
      itemId: item.id,
      quantity: accepted,
      ...placement,
      equippedSlotKey: null,
      state: { ...item.initialState },
    });
    remaining -= accepted;
  }
  return { ...state, inventory };
}

/**
 * Grant an item through authored runtime effects. When configured, one newly
 * granted instance is equipped to its stable body-slot key through the same
 * transactional replacement path used by player equipment operations.
 */
export function giveInventoryItem(
  snapshot: ProjectSnapshot,
  state: PlayState,
  itemId: string,
  quantity = 1,
): PlayState {
  const item = snapshot.items.find((candidate) => candidate.id === itemId);
  const grantedQuantity = Math.floor(quantity);
  if (!item || grantedQuantity <= 0 || !item.equipOnGiveSlotKey) {
    return addInventoryItem(snapshot, state, itemId, quantity);
  }

  const slot = activeBodySlots(snapshot, state).find((candidate) => candidate.key === item.equipOnGiveSlotKey);
  if (!slot || !itemCanEquipToSlot(item, slot)) {
    return addInventoryItem(snapshot, state, itemId, grantedQuantity);
  }

  const instanceId = crypto.randomUUID();
  let nextState = state;

  if (item.equippedStorage === "slot") {
    const provisionalState: PlayState = {
      ...state,
      inventory: [...state.inventory, {
        instanceId,
        itemId: item.id,
        quantity: 1,
        x: 0,
        y: 0,
        equippedSlotKey: slot.key,
        state: { ...item.initialState },
      }],
    };
    const candidateState = equipInventoryEntry(snapshot, provisionalState, instanceId, slot.key);
    const safelyReplaced = candidateState.inventory
      .filter((entry) => entry.equippedSlotKey === slot.key)
      .every((entry) => entry.instanceId === instanceId);
    nextState = safelyReplaced
      ? candidateState
      : addInventoryItem(snapshot, state, item.id, 1);
  } else {
    const placement = findFirstPlacement(snapshot, state, item);
    if (placement) {
      const provisionalState: PlayState = {
        ...state,
        inventory: [...state.inventory, {
          instanceId,
          itemId: item.id,
          quantity: 1,
          ...placement,
          equippedSlotKey: null,
          state: { ...item.initialState },
        }],
      };
      nextState = equipInventoryEntry(snapshot, provisionalState, instanceId, slot.key);
    } else {
      nextState = addInventoryItem(snapshot, state, item.id, 1);
    }
  }

  return addInventoryItem(snapshot, nextState, item.id, grantedQuantity - 1);
}

export function createStartingInventory(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const bodyType = activeBodyType(snapshot, state);
  const remaining = new Map(snapshot.items.map((item) => [item.id, Math.max(0, item.startingQuantity ?? 0)]));
  let nextState = { ...state, inventory: [] as InventoryEntry[] };
  const occupiedSlots = new Set<string>();

  for (const assignment of bodyType?.startingEquipment ?? []) {
    const item = snapshot.items.find((candidate) => candidate.id === assignment.itemId);
    const slot = bodyType?.slots?.find((candidate) => candidate.key === assignment.slotKey);
    const available = remaining.get(assignment.itemId) ?? 0;
    if (!item || !slot || available < 1 || occupiedSlots.has(slot.key) || !itemCanEquipToSlot(item, slot)) continue;
    const placement = item.equippedStorage === "slot"
      ? { x: 0, y: 0 }
      : findFirstPlacement(snapshot, nextState, item);
    if (!placement) continue;
    nextState = {
      ...nextState,
      inventory: [...nextState.inventory, {
        instanceId: crypto.randomUUID(),
        itemId: item.id,
        quantity: 1,
        ...placement,
        equippedSlotKey: slot.key,
        state: { ...item.initialState },
      }],
    };
    remaining.set(item.id, available - 1);
    occupiedSlots.add(slot.key);
  }

  for (const item of snapshot.items) {
    nextState = addInventoryItem(snapshot, nextState, item.id, remaining.get(item.id) ?? 0);
  }
  return nextState;
}

export function addNewDefaultItemsToPlayState(
  previousSnapshot: ProjectSnapshot,
  nextSnapshot: ProjectSnapshot,
  state: PlayState,
) {
  const previousItemIds = new Set(previousSnapshot.items.map((item) => item.id));
  let nextState = state;
  for (const item of nextSnapshot.items) {
    if (previousItemIds.has(item.id)) continue;
    const currentQuantity = nextState.inventory
      .filter((entry) => entry.itemId === item.id)
      .reduce((total, entry) => total + entry.quantity, 0);
    const missingQuantity = Math.max(0, (item.startingQuantity ?? 0) - currentQuantity);
    nextState = addInventoryItem(nextSnapshot, nextState, item.id, missingQuantity);
  }
  return nextState;
}

export function removeInventoryItem(state: PlayState, itemId: string, quantity = 1): PlayState {
  let remaining = Math.max(0, Math.floor(quantity));
  const inventory: InventoryEntry[] = [];
  for (const original of state.inventory) {
    const entry = { ...original, state: { ...original.state } };
    if (entry.itemId !== itemId || remaining === 0) {
      inventory.push(entry);
      continue;
    }
    const removed = Math.min(remaining, entry.quantity);
    entry.quantity -= removed;
    remaining -= removed;
    if (entry.quantity > 0) inventory.push(entry);
  }
  return { ...state, inventory };
}
