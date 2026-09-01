import {
  COMPUTED_OPERATION_TARGET_ADAPTER,
  VARIABLE_OPERATION_TARGET_ADAPTER,
} from "../state/operationAdapter";
import { WORLD_ENTITY_OPERATION_TARGET_ADAPTER } from "../world/operationAdapter";
import type { OperationTargetAdapter } from "./targetAdapter";

export const OPERATION_TARGET_ADAPTERS: Readonly<Record<string, OperationTargetAdapter>> = Object.fromEntries([
  VARIABLE_OPERATION_TARGET_ADAPTER,
  COMPUTED_OPERATION_TARGET_ADAPTER,
  WORLD_ENTITY_OPERATION_TARGET_ADAPTER,
].map((adapter) => [adapter.kind, adapter]));
