import { ITEM_OPERATION_TARGET_ADAPTER } from "../inventory/operationAdapter";
import {
  COMPUTED_OPERATION_TARGET_ADAPTER,
  VARIABLE_OPERATION_TARGET_ADAPTER,
} from "../state/operationAdapter";
import type { OperationTargetAdapter } from "./targetAdapter";

/**
 * Explicit operation target composition root.
 *
 * Future features add one adapter contribution here; generic operation runtime
 * does not gain feature-specific switch branches.
 */
export const OPERATION_TARGET_ADAPTERS: Readonly<Record<string, OperationTargetAdapter>> = Object.fromEntries([
  ITEM_OPERATION_TARGET_ADAPTER,
  VARIABLE_OPERATION_TARGET_ADAPTER,
  COMPUTED_OPERATION_TARGET_ADAPTER,
].map((adapter) => [adapter.kind, adapter]));
