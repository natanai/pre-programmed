import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type {
  BodySlotDefinition,
  EquipmentAssignment,
  InventoryEntry,
  ItemDefinition,
} from "./model";

export const INVENTORY_COLUMNS = 10;
export const INVENTORY_ROWS = 6;

function itemForEntry(snapshot: ProjectSnapshot, entry: InventoryEntry) {
  return snapshot.items.find((item) => item.id === entry.itemId);
}

function uniqueSlotKeys(keys: readonly string[]) {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}

export function entryIsEquipped(entry: InventoryEntry) {
  return Boolean(entry.equipment?.anchorSlotKey);
}

export function occupiedEquipmentSlotKeys(entry: InventoryEntry) {
  return entry.equipment?.occupiedSlotKeys ?? [];
}

export function entryOccupiesInventoryGrid(snapshot: ProjectSnapshot, entry: InventoryEntry) {
  const item = itemForEntry(snapshot, entry);
  return !entryIsEquipped(entry) || item?.equippedStorage !== "slot";
}

export function activeBodyType(snapshot: ProjectSnapshot, state: PlayState) {
  return (snapshot.bodyBackgrounds ?? []).find((bodyType) => bodyType.id === state.bodyBackgroundId);
}

export function activeBodySlots(snapshot: ProjectSnapshot, state: PlayState): BodySlotDefinition[] {
  return activeBodyType(snapshot, state)?.slots ?? [];
}

/** Whether a body slot is a valid anchor for an item definition. */
export function itemCanEquipToSlot(item: ItemDefinition, slot: BodySlotDefinition) {
  const placements = item.equipmentPlacements ?? [];
  return placements.length === 0 || placements.some((placement) => placement.anchorSlotKey === slot.key);
}

/**
 * Resolve one authored placement against the active body. The returned occupied
 * set is canonical and always contains the anchor. An explicit placement is
 * unavailable when any slot it needs is absent on the active body type.
 */
export function equipmentAssignmentForSlot(
  snapshot: ProjectSnapshot,
  state: PlayState,
  item: ItemDefinition,
  anchorSlotKey: string,
): EquipmentAssignment | null {
  const bodySlots = activeBodySlots(snapshot, state);
  const anchor = bodySlots.find((slot) => slot.key === anchorSlotKey);
  if (!anchor) return null;

  const placements = item.equipmentPlacements ?? [];
  if (!placements.length) {
    return { anchorSlotKey, occupiedSlotKeys: [anchorSlotKey] };
  }

  const placement = placements.find((candidate) => candidate.anchorSlotKey === anchorSlotKey);
  if (!placement) return null;
  const occupiedSlotKeys = uniqueSlotKeys([anchorSlotKey, ...(placement.occupiedSlotKeys ?? [])]);
  const activeKeys = new Set(bodySlots.map((slot) => slot.key));
  if (occupiedSlotKeys.some((slotKey) => !activeKeys.has(slotKey))) return null;
  return { anchorSlotKey, occupiedSlotKeys };
}

export function compatibleBodySlots(snapshot: ProjectSnapshot, state: PlayState, item: ItemDefinition) {
  return activeBodySlots(snapshot, state).filter((slot) => equipmentAssignmentForSlot(snapshot, state, item, slot.key));
}

function assignmentsOverlap(left: readonly string[], right: readonly string[]) {
  const rightKeys = new Set(right);
  return left.some((key) => rightKeys.has(key));
}

function unequipEntryInEntries(
  snapshot: ProjectSnapshot,
  entries: InventoryEntry[],
  instanceId: string,
): InventoryEntry[] | null {
  const entry = entries.find((candidate) => candidate.instanceId === instanceId);
  if (!entry?.equipment) return entries;
  const item = itemForEntry(snapshot, entry);
  if (!item) return null;

  if (item.equippedStorage !== "slot") {
    return entries.map((candidate) => candidate.instanceId === instanceId
      ? { ...candidate, equipment: null }
      : candidate);
  }

  let placement = { x: entry.x, y: entry.y };
  if (!canPlaceItem(snapshot, entries, item, placement.x, placement.y, entry.instanceId)) {
    const fallbackPlacement = findFirstPlacementInEntries(snapshot, entries, item);
    if (!fallbackPlacement) return null;
    placement = fallbackPlacement;
  }
  return entries.map((candidate) => candidate.instanceId === instanceId
    ? { ...candidate, ...placement, equipment: null }
    : candidate);
}

/**
 * Equip transactionally. Every conflicting instance across the placement's
 * complete occupied set is returned to general inventory first. If any
 * slot-carried conflict cannot be placed, the entire operation is refused.
 */
export function equipInventoryEntry(
  snapshot: ProjectSnapshot,
  state: PlayState,
  instanceId: string,
  anchorSlotKey: string,
): PlayState {
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
  if (!entry || !item) return state;
  const assignment = equipmentAssignmentForSlot(snapshot, state, item, anchorSlotKey);
  if (!assignment) return state;

  const conflicts = state.inventory.filter((candidate) =>
    candidate.instanceId !== instanceId
    && candidate.equipment
    && assignmentsOverlap(candidate.equipment.occupiedSlotKeys, assignment.occupiedSlotKeys));

  // Assign first so slot-only target equipment releases its grid cells before
  // displaced items search for a safe return position.
  let inventory: InventoryEntry[] = state.inventory.map((candidate) => candidate.instanceId === instanceId
    ? { ...candidate, equipment: assignment }
    : candidate);

  for (const conflict of conflicts) {
    const next = unequipEntryInEntries(snapshot, inventory, conflict.instanceId);
    if (!next) return state;
    inventory = next;
  }

  return { ...state, inventory };
}

export function unequipInventoryEntry(snapshot: ProjectSnapshot, state: PlayState, instanceId: string): PlayState {
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  if (!entry?.equipment) return state;
  const inventory = unequipEntryInEntries(snapshot, state.inventory, instanceId);
  return inventory ? { ...state, inventory } : state;
}

function equipmentAssignmentsValid(snapshot: ProjectSnapshot, state: PlayState) {
  const claimed = new Set<string>();
  for (const entry of state.inventory) {
    if (!entry.equipment) continue;
    const item = itemForEntry(snapshot, entry);
    if (!item) return false;
    const canonical = equipmentAssignmentForSlot(snapshot, state, item, entry.equipment.anchorSlotKey);
    if (!canonical) return false;
    const stored = uniqueSlotKeys(entry.equipment.occupiedSlotKeys);
    if (stored.length !== canonical.occupiedSlotKeys.length || stored.some((key) => !canonical.occupiedSlotKeys.includes(key))) {
      return false;
    }
    if (canonical.occupiedSlotKeys.some((key) => claimed.has(key))) return false;
    canonical.occupiedSlotKeys.forEach((key) => claimed.add(key));
  }
  return true;
}

/**
 * Reconcile authored placement changes, old play saves, and body changes. Valid
 * equipment is normalized to the current placement definition. Invalid or
 * overlapping assignments are unequipped when grid capacity permits.
 */
export function reconcileEquippedItems(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  let inventory: InventoryEntry[] = state.inventory.map((entry) => ({
    ...entry,
    equipment: entry.equipment
      ? { ...entry.equipment, occupiedSlotKeys: [...entry.equipment.occupiedSlotKeys] }
      : null,
  }));
  const claimed = new Set<string>();

  for (const original of inventory) {
    if (!original.equipment) continue;
    const current = inventory.find((entry) => entry.instanceId === original.instanceId);
    const item = current ? itemForEntry(snapshot, current) : undefined;
    const canonical = current && item
      ? equipmentAssignmentForSlot(snapshot, { ...state, inventory }, item, current.equipment?.anchorSlotKey ?? "")
      : null;
    const conflicts = canonical?.occupiedSlotKeys.some((key) => claimed.has(key)) ?? true;

    if (!canonical || conflicts) {
      const next = unequipEntryInEntries(snapshot, inventory, original.instanceId);
      if (next) inventory = next;
      continue;
    }

    inventory = inventory.map((entry) => entry.instanceId === original.instanceId
      ? { ...entry, equipment: canonical }
      : entry);
    canonical.occupiedSlotKeys.forEach((key) => claimed.add(key));
  }

  return { ...state, inventory };
}

/** Change body type atomically; refuse if required occupied slots disappear or displaced slot-carried items cannot return to the grid. */
export function setActiveBodyType(snapshot: ProjectSnapshot, state: PlayState, bodyTypeId: string | null): PlayState {
  if (bodyTypeId && !(snapshot.bodyBackgrounds ?? []).some((bodyType) => bodyType.id === bodyTypeId)) return state;
  const candidate = reconcileEquippedItems(snapshot, { ...state, bodyBackgroundId: bodyTypeId });
  return equipmentAssignmentsValid(snapshot, candidate) ? candidate : state;
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
      if (entry.itemId !== item.id || entry.equipment || entry.quantity >= item.maxStack) continue;
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
      equipment: null,
      state: { ...item.initialState },
    });
    remaining -= accepted;
  }
  return { ...state, inventory };
}

/** Grant an item and, when configured, equip one new instance through the same multi-slot transaction used by player operations. */
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

  const assignment = equipmentAssignmentForSlot(snapshot, state, item, item.equipOnGiveSlotKey);
  if (!assignment) return addInventoryItem(snapshot, state, itemId, grantedQuantity);

  const instanceId = crypto.randomUUID();
  const placement = item.equippedStorage === "slot"
    ? { x: 0, y: 0 }
    : findFirstPlacement(snapshot, state, item);
  if (!placement) return addInventoryItem(snapshot, state, item.id, grantedQuantity);

  const provisionalState: PlayState = {
    ...state,
    inventory: [...state.inventory, {
      instanceId,
      itemId: item.id,
      quantity: 1,
      ...placement,
      equipment: null,
      state: { ...item.initialState },
    }],
  };
  const equipped = equipInventoryEntry(snapshot, provisionalState, instanceId, assignment.anchorSlotKey);
  const equippedEntry = equipped.inventory.find((entry) => entry.instanceId === instanceId);
  const nextState = equippedEntry?.equipment
    ? equipped
    : addInventoryItem(snapshot, state, item.id, 1);

  return addInventoryItem(snapshot, nextState, item.id, grantedQuantity - 1);
}

export function createStartingInventory(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const bodyType = activeBodyType(snapshot, state);
  const remaining = new Map(snapshot.items.map((item) => [item.id, Math.max(0, item.startingQuantity ?? 0)]));
  let nextState = { ...state, inventory: [] as InventoryEntry[] };
  const occupiedSlots = new Set<string>();

  for (const startingAssignment of bodyType?.startingEquipment ?? []) {
    const item = snapshot.items.find((candidate) => candidate.id === startingAssignment.itemId);
    const available = remaining.get(startingAssignment.itemId) ?? 0;
    if (!item || available < 1) continue;
    const equipment = equipmentAssignmentForSlot(snapshot, nextState, item, startingAssignment.slotKey);
    if (!equipment || equipment.occupiedSlotKeys.some((key) => occupiedSlots.has(key))) continue;
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
        equipment,
        state: { ...item.initialState },
      }],
    };
    remaining.set(item.id, available - 1);
    equipment.occupiedSlotKeys.forEach((key) => occupiedSlots.add(key));
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
