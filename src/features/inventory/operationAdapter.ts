import { authoredSource } from "../../engine/presentation/authoredSource";
import type { OperationArguments, OperationId } from "../operations/model";
import type { AuthorOperationDefinition, OperationTargetAdapter } from "../operations/targetAdapter";
import {
  canPlaceItem,
  compatibleBodySlots,
  entryOccupiesInventoryGrid,
  equipInventoryEntry,
  occupiedEquipmentSlotKeys,
  unequipInventoryEntry,
} from "./runtime";

export const INVENTORY_OPERATION_DEFINITIONS: readonly AuthorOperationDefinition[] = [
  { value: "inspect", label: "inspect", targetKinds: ["inventory.item"] },
  { value: "use", label: "use", targetKinds: ["inventory.item"] },
  { value: "move", label: "move", targetKinds: ["inventory.item"] },
  { value: "remove", label: "remove", targetKinds: ["inventory.item"] },
  { value: "equip", label: "equip", targetKinds: ["inventory.item"] },
  { value: "unequip", label: "unequip", targetKinds: ["inventory.item"] },
];

const DEFAULT_ITEM_OPERATIONS: OperationId[] = INVENTORY_OPERATION_DEFINITIONS.map((definition) => definition.value);

function requestedSlotKey(argumentsValue?: OperationArguments) {
  const argument = argumentsValue?.slot;
  return argument?.kind === "text" ? argument.value : "";
}

function equipResult(
  snapshot: Parameters<NonNullable<OperationTargetAdapter["defaultOperation"]>>[0]["snapshot"],
  state: Parameters<NonNullable<OperationTargetAdapter["defaultOperation"]>>[0]["state"],
  instanceId: string,
  slotKey: string,
) {
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
  if (!entry || !item) return { accepted: false, state };
  const slots = compatibleBodySlots(snapshot, state, item);
  const slot = slotKey ? slots.find((candidate) => candidate.key === slotKey) : slots.length === 1 ? slots[0] : undefined;
  if (!slot) return { accepted: false, state };
  const nextState = equipInventoryEntry(snapshot, state, instanceId, slot.key);
  if (nextState === state) return { accepted: false, state, responseText: "No inventory space for displaced equipment." };
  const nextEntry = nextState.inventory.find((candidate) => candidate.instanceId === instanceId);
  const occupiedNames = occupiedEquipmentSlotKeys(nextEntry ?? entry)
    .filter((key) => key !== slot.key)
    .map((key) => (snapshot.bodyBackgrounds ?? [])
      .find((bodyType) => bodyType.id === nextState.bodyBackgroundId)?.slots?.find((candidate) => candidate.key === key)?.name ?? key);
  return {
    accepted: true,
    state: nextState,
    responseText: occupiedNames.length
      ? `Equipped to ${slot.name}; also occupies ${occupiedNames.join(", ")}.`
      : `Equipped to ${slot.name}.`,
  };
}

export const ITEM_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: "item",
  resolve(snapshot, state, target) {
    if (target.kind !== "item") return null;
    const entry = state.inventory.find((candidate) => candidate.instanceId === target.id);
    const definition = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
    if (!entry || !definition) return null;
    return {
      definitionId: definition.id,
      label: definition.name || definition.key || target.id,
      interactable: definition.interactable ?? true,
      operations: definition.operations ?? DEFAULT_ITEM_OPERATIONS,
      hooks: definition.hooks ?? [],
      authorSource: authoredSource("item", definition.id),
    };
  },
  applySuccessfulHook({ snapshot, state, target, operation, arguments: argumentsValue, placement }) {
    const entry = state.inventory.find((candidate) => candidate.instanceId === target.id);
    const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
    if (!entry || !item) return { accepted: false, state };

    if (operation === "move" && placement) {
      if (!entryOccupiesInventoryGrid(snapshot, entry)) return { accepted: false, state };
      const accepted = canPlaceItem(snapshot, state.inventory, item, placement.x, placement.y, entry.instanceId);
      return {
        accepted,
        state: accepted ? {
          ...state,
          inventory: state.inventory.map((candidate) => candidate.instanceId === entry.instanceId
            ? { ...candidate, x: placement.x, y: placement.y }
            : candidate),
        } : state,
      };
    }

    if (operation === "equip") {
      return equipResult(snapshot, state, entry.instanceId, requestedSlotKey(argumentsValue));
    }

    if (operation === "unequip") {
      const nextState = unequipInventoryEntry(snapshot, state, entry.instanceId);
      return { accepted: nextState !== state, state: nextState };
    }

    if (operation === "remove") {
      return {
        accepted: true,
        state: { ...state, inventory: state.inventory.filter((candidate) => candidate.instanceId !== entry.instanceId) },
      };
    }

    return { accepted: true, state };
  },
  defaultOperation({ snapshot, state, target, operation, arguments: argumentsValue, placement }) {
    const entry = state.inventory.find((candidate) => candidate.instanceId === target.id);
    const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
    if (!entry || !item) return { accepted: false, state };

    if (operation === "inspect") {
      return { accepted: true, responseText: item.description, state };
    }

    if (operation === "move" && placement) {
      if (!entryOccupiesInventoryGrid(snapshot, entry)) return { accepted: false, state };
      const accepted = canPlaceItem(snapshot, state.inventory, item, placement.x, placement.y, entry.instanceId);
      return {
        accepted,
        state: accepted ? {
          ...state,
          inventory: state.inventory.map((candidate) => candidate.instanceId === entry.instanceId
            ? { ...candidate, x: placement.x, y: placement.y }
            : candidate),
        } : state,
      };
    }

    if (operation === "equip") {
      return equipResult(snapshot, state, entry.instanceId, requestedSlotKey(argumentsValue));
    }

    if (operation === "unequip") {
      if (!entry.equipment) return { accepted: false, state };
      const nextState = unequipInventoryEntry(snapshot, state, entry.instanceId);
      return nextState === state
        ? { accepted: false, responseText: "No inventory space to unequip.", state }
        : { accepted: true, responseText: "Unequipped.", state: nextState };
    }

    if (operation === "remove" && item.removable) {
      return {
        accepted: true,
        state: { ...state, inventory: state.inventory.filter((candidate) => candidate.instanceId !== entry.instanceId) },
      };
    }

    return { accepted: false, state };
  },
};
