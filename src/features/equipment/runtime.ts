import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { PossessionServices } from "../../engine/possessions/extensions";

export function activeBodyType(snapshot: ProjectSnapshot, state: PlayState) {
  return snapshot.bodyTypes.find((bodyType) => bodyType.id === state.activeBodyTypeId);
}

export function equipmentRule(snapshot: ProjectSnapshot, itemId: string) {
  return snapshot.equipmentRules.find((rule) => rule.itemId === itemId);
}

export function compatibleSlots(snapshot: ProjectSnapshot, state: PlayState, itemId: string) {
  const slots = activeBodyType(snapshot, state)?.slots ?? [];
  const allowed = equipmentRule(snapshot, itemId)?.slotKeys ?? [];
  return allowed.length ? slots.filter((slot) => allowed.includes(slot.key)) : slots;
}

export function equipInventoryInstance(snapshot: ProjectSnapshot, state: PlayState, instanceId: string, requestedSlotKey: string, services: PossessionServices) {
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  if (!entry) return { accepted: false, state };
  const slots = compatibleSlots(snapshot, state, entry.itemId);
  const slot = requestedSlotKey ? slots.find((candidate) => candidate.key === requestedSlotKey) : slots.length === 1 ? slots[0] : undefined;
  if (!slot) return { accepted: false, state };

  let nextState = state;
  const displacedId = state.equipmentAssignments[slot.key];
  if (displacedId && displacedId !== instanceId) {
    const displaced = state.inventory.find((candidate) => candidate.instanceId === displacedId);
    const displacedRule = displaced ? equipmentRule(snapshot, displaced.itemId) : undefined;
    if (displacedRule?.storage === "slot") {
      const returned = services.returnToPrimaryContainer(snapshot, nextState, displacedId);
      if (!returned.accepted) return { accepted: false, state, responseText: "No inventory space for the displaced item." };
      nextState = returned.state;
    }
  }

  const rule = equipmentRule(snapshot, entry.itemId);
  if (rule?.storage === "slot") nextState = services.removeFromPrimaryContainer(nextState, instanceId);
  const equipmentAssignments = { ...nextState.equipmentAssignments };
  for (const [key, assignedId] of Object.entries(equipmentAssignments)) if (assignedId === instanceId) delete equipmentAssignments[key];
  equipmentAssignments[slot.key] = instanceId;
  return { accepted: true, state: { ...nextState, equipmentAssignments }, responseText: `Equipped to ${slot.name}.` };
}

export function unequipInventoryInstance(snapshot: ProjectSnapshot, state: PlayState, instanceId: string, services: PossessionServices) {
  const slotKey = Object.entries(state.equipmentAssignments).find(([, assignedId]) => assignedId === instanceId)?.[0];
  if (!slotKey) return { accepted: false, state };
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  if (!entry) return { accepted: false, state };
  let nextState = state;
  if (equipmentRule(snapshot, entry.itemId)?.storage === "slot") {
    const returned = services.returnToPrimaryContainer(snapshot, nextState, instanceId);
    if (!returned.accepted) return { accepted: false, state, responseText: "No inventory space to unequip." };
    nextState = returned.state;
  }
  const equipmentAssignments = { ...nextState.equipmentAssignments };
  delete equipmentAssignments[slotKey];
  return { accepted: true, state: { ...nextState, equipmentAssignments }, responseText: "Unequipped." };
}

export function reconcileEquipment(snapshot: ProjectSnapshot, state: PlayState, services: PossessionServices) {
  const validSlots = new Set((activeBodyType(snapshot, state)?.slots ?? []).map((slot) => slot.key));
  let nextState = state;
  for (const [slotKey, instanceId] of Object.entries(state.equipmentAssignments ?? {})) {
    if (validSlots.has(slotKey) && state.inventory.some((entry) => entry.instanceId === instanceId)) continue;
    const result = unequipInventoryInstance(snapshot, nextState, instanceId, services);
    nextState = result.accepted ? result.state : { ...nextState, equipmentAssignments: Object.fromEntries(Object.entries(nextState.equipmentAssignments).filter(([key]) => key !== slotKey)) };
  }
  return nextState;
}

export function setActiveBodyType(snapshot: ProjectSnapshot, state: PlayState, bodyTypeId: string | null, services: PossessionServices) {
  if (bodyTypeId && !snapshot.bodyTypes.some((bodyType) => bodyType.id === bodyTypeId)) return state;
  return reconcileEquipment(snapshot, { ...state, activeBodyTypeId: bodyTypeId }, services);
}
