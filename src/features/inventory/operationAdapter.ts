import { applyPossessionItemOperation, applyPossessionRemovalExtensions } from "../../engine/possessions/catalog";
import type { OperationId } from "../operations/model";
import type { AuthorOperationDefinition, OperationTargetAdapter } from "../operations/targetAdapter";
import { INVENTORY_POSSESSION_SERVICES, moveInventoryEntry } from "./runtime";

export const INVENTORY_OPERATION_DEFINITIONS: readonly AuthorOperationDefinition[] = [
  { value: "inspect", label: "inspect", targetKinds: ["inventory.item"] },
  { value: "use", label: "use", targetKinds: ["inventory.item"] },
  { value: "move", label: "move", targetKinds: ["inventory.item"] },
  { value: "remove", label: "remove", targetKinds: ["inventory.item"] },
];
const DEFAULT_ITEM_OPERATIONS: OperationId[] = INVENTORY_OPERATION_DEFINITIONS.map((definition) => definition.value);

function extensionResult(args: Parameters<NonNullable<OperationTargetAdapter["defaultOperation"]>>[0]) {
  return applyPossessionItemOperation({ ...args, services: INVENTORY_POSSESSION_SERVICES });
}
function removeInstance(snapshot: Parameters<typeof applyPossessionRemovalExtensions>[0], state: Parameters<typeof applyPossessionRemovalExtensions>[1], instanceId: string) {
  const nextState = {
    ...state,
    inventory: state.inventory.filter((entry) => entry.instanceId !== instanceId),
    inventoryPositions: Object.fromEntries(Object.entries(state.inventoryPositions).filter(([id]) => id !== instanceId)),
  };
  return applyPossessionRemovalExtensions(snapshot, state, nextState, [instanceId], INVENTORY_POSSESSION_SERVICES);
}

export const ITEM_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: "item",
  resolve(snapshot, state, target) {
    if (target.kind !== "item") return null;
    const entry = state.inventory.find((candidate) => candidate.instanceId === target.id);
    const definition = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
    if (!entry || !definition) return null;
    return { definitionId: definition.id, label: definition.name || definition.key || target.id, interactable: definition.interactable ?? true, operations: definition.operations ?? DEFAULT_ITEM_OPERATIONS, hooks: definition.hooks ?? [] };
  },
  applySuccessfulHook(args) {
    const extension = extensionResult(args);
    if (extension) return extension;
    if (args.operation === "move" && args.placement) {
      const nextState = moveInventoryEntry(args.snapshot, args.state, args.target.id, args.placement.x, args.placement.y);
      return { accepted: nextState !== args.state, state: nextState };
    }
    if (args.operation === "remove") return { accepted: true, state: removeInstance(args.snapshot, args.state, args.target.id) };
    return { accepted: true, state: args.state };
  },
  defaultOperation(args) {
    const extension = extensionResult(args);
    if (extension) return extension;
    const entry = args.state.inventory.find((candidate) => candidate.instanceId === args.target.id);
    const item = args.snapshot.items.find((candidate) => candidate.id === entry?.itemId);
    if (!entry || !item) return { accepted: false, state: args.state };
    if (args.operation === "inspect") return { accepted: true, responseText: item.description, state: args.state };
    if (args.operation === "move" && args.placement) {
      const nextState = moveInventoryEntry(args.snapshot, args.state, entry.instanceId, args.placement.x, args.placement.y);
      return { accepted: nextState !== args.state, state: nextState };
    }
    if (args.operation === "remove" && item.removable) return { accepted: true, state: removeInstance(args.snapshot, args.state, entry.instanceId) };
    return { accepted: false, state: args.state };
  },
};
