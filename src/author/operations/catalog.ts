import { INVENTORY_OPERATION_DEFINITIONS } from "../../features/inventory/operationAdapter";
import type { AuthorOperationDefinition } from "../../features/operations/targetAdapter";

/**
 * Explicit Author operation composition root.
 * Future features contribute descriptors here without changing the hook editor.
 */
export const AUTHOR_OPERATION_DEFINITIONS: readonly AuthorOperationDefinition[] = [
  ...INVENTORY_OPERATION_DEFINITIONS,
];
