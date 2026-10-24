import type { OperationId } from "../operations/model";

/**
 * Operations implemented by the optional Inventory player UI.
 * These are native UI capabilities, not Player Command grammar or Author menu entries.
 */
export const NATIVE_ITEM_OPERATIONS: OperationId[] = ["inspect", "use", "move", "remove", "equip", "unequip"];
