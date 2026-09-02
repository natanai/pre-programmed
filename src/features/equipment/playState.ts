import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { PossessionServices } from "../../engine/possessions/extensions";
import { equipInventoryInstance, reconcileEquipment } from "./runtime";

export function initializeEquipmentPlayState(snapshot: ProjectSnapshot, state: PlayState, services: PossessionServices): PlayState {
  let nextState: PlayState = { ...state, activeBodyTypeId: snapshot.startingBodyTypeId, equipmentAssignments: {} };
  const bodyType = snapshot.bodyTypes.find((candidate) => candidate.id === snapshot.startingBodyTypeId);
  const used = new Set<string>();
  for (const assignment of bodyType?.startingEquipment ?? []) {
    const entry = nextState.inventory.find((candidate) => candidate.itemId === assignment.itemId && !used.has(candidate.instanceId));
    if (!entry) continue;
    const result = equipInventoryInstance(snapshot, nextState, entry.instanceId, assignment.slotKey, services);
    if (result.accepted) {
      nextState = result.state;
      used.add(entry.instanceId);
    }
  }
  return nextState;
}

export function reconcileEquipmentPlayState(snapshot: ProjectSnapshot, state: PlayState, services: PossessionServices): PlayState {
  const legacy = state as PlayState & { bodyBackgroundId?: string | null; equipmentAssignments?: Record<string, string>; inventory?: Array<any> };
  let equipmentAssignments = { ...(legacy.equipmentAssignments ?? {}) };
  if (!Object.keys(equipmentAssignments).length) {
    for (const entry of legacy.inventory ?? []) if (entry.equippedSlotKey) equipmentAssignments[entry.equippedSlotKey] = entry.instanceId;
  }
  const activeBodyTypeId = state.activeBodyTypeId ?? legacy.bodyBackgroundId ?? snapshot.startingBodyTypeId ?? null;
  return reconcileEquipment(snapshot, { ...state, activeBodyTypeId, equipmentAssignments }, services);
}
