import type { OperationId } from "../operations/model";
import type { AuthorOperationDefinition, OperationTargetAdapter } from "../operations/targetAdapter";
import { canPlaceItem } from "./runtime";

export const INVENTORY_OPERATION_DEFINITIONS: readonly AuthorOperationDefinition[] = [
  { value: "inspect", label: "inspect" },
  { value: "use", label: "use" },
  { value: "move", label: "move" },
  { value: "remove", label: "remove" },
];

const DEFAULT_ITEM_OPERATIONS: OperationId[] = INVENTORY_OPERATION_DEFINITIONS.map((definition) => definition.value);

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
    };
  },
  applySuccessfulHook({ snapshot, state, target, operation, placement }) {
    const entry = state.inventory.find((candidate) => candidate.instanceId === target.id);
    const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
    if (!entry || !item) return { accepted: false, state };

    if (operation === "move" && placement) {
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

    if (operation === "remove") {
      return {
        accepted: true,
        state: { ...state, inventory: state.inventory.filter((candidate) => candidate.instanceId !== entry.instanceId) },
      };
    }

    return { accepted: true, state };
  },
  defaultOperation({ snapshot, state, target, operation, placement }) {
    const entry = state.inventory.find((candidate) => candidate.instanceId === target.id);
    const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
    if (!entry || !item) return { accepted: false, state };

    if (operation === "inspect") {
      return { accepted: true, responseText: item.description, state };
    }

    if (operation === "move" && placement) {
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

    if (operation === "remove" && item.removable) {
      return {
        accepted: true,
        state: { ...state, inventory: state.inventory.filter((candidate) => candidate.instanceId !== entry.instanceId) },
      };
    }

    return { accepted: false, state };
  },
};
