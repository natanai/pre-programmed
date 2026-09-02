import { ITEM_OPERATION_TARGET_ADAPTER } from "../inventory/operationAdapter";
import { DERIVED_VALUE_OPERATION_TARGET_ADAPTER, VALUE_OPERATION_TARGET_ADAPTER } from "../values/operationAdapter";
import { WORLD_ENTITY_OPERATION_TARGET_ADAPTER } from "../world/operationAdapter";
import type { OperationTargetAdapter } from "./targetAdapter";

export const OPERATION_TARGET_ADAPTERS: Readonly<Record<string, OperationTargetAdapter>> = Object.fromEntries([
  ITEM_OPERATION_TARGET_ADAPTER,
  VALUE_OPERATION_TARGET_ADAPTER,
  DERIVED_VALUE_OPERATION_TARGET_ADAPTER,
  WORLD_ENTITY_OPERATION_TARGET_ADAPTER,
].map((adapter) => [adapter.kind, adapter]));
