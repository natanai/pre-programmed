import { EQUIPMENT_POSSESSION_EXTENSION } from "../../features/equipment/possessionExtension";
import type { PlayState, ProjectSnapshot } from "../project/model";
import type { PossessionExtension, PossessionOperationContext, PossessionServices } from "./extensions";

const POSSESSION_EXTENSIONS: readonly PossessionExtension[] = [EQUIPMENT_POSSESSION_EXTENSION];

export function applyPossessionItemOperation(context: PossessionOperationContext) {
  for (const extension of POSSESSION_EXTENSIONS) {
    const result = extension.applyItemOperation?.(context);
    if (result) return result;
  }
  return null;
}

export function applyPossessionGrantExtensions(snapshot: ProjectSnapshot, before: PlayState, after: PlayState, itemId: string, services: PossessionServices) {
  return POSSESSION_EXTENSIONS.reduce((state, extension) => extension.afterGrant?.(snapshot, before, state, itemId, services) ?? state, after);
}

export function applyPossessionRemovalExtensions(snapshot: ProjectSnapshot, before: PlayState, after: PlayState, removedInstanceIds: readonly string[], services: PossessionServices) {
  return POSSESSION_EXTENSIONS.reduce((state, extension) => extension.afterRemove?.(snapshot, before, state, removedInstanceIds, services) ?? state, after);
}
