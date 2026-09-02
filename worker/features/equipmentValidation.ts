import { object } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

function validSlots(value: unknown) {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const candidate of value) {
    if (!object(candidate)) return false;
    if (typeof candidate.id !== "string" || !candidate.id || ids.has(candidate.id)) return false;
    if (typeof candidate.key !== "string" || !candidate.key.trim() || keys.has(candidate.key)) return false;
    if (typeof candidate.name !== "string" || !candidate.name.trim()) return false;
    ids.add(candidate.id);
    keys.add(candidate.key);

    const { x, y, width, height } = candidate;
    if (
      typeof x !== "number" || !Number.isFinite(x)
      || typeof y !== "number" || !Number.isFinite(y)
      || typeof width !== "number" || !Number.isFinite(width)
      || typeof height !== "number" || !Number.isFinite(height)
    ) return false;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 100 || y + height > 100) return false;
  }
  return true;
}

function validStartingEquipment(value: unknown, slotKeys: ReadonlySet<string>) {
  if (!Array.isArray(value)) return false;
  const assigned = new Set<string>();
  for (const candidate of value) {
    if (!object(candidate)) return false;
    if (typeof candidate.slotKey !== "string" || !candidate.slotKey.trim() || assigned.has(candidate.slotKey)) return false;
    if (!slotKeys.has(candidate.slotKey)) return false;
    if (typeof candidate.itemId !== "string" || !candidate.itemId) return false;
    assigned.add(candidate.slotKey);
  }
  return true;
}

function validStringSet(value: unknown) {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "string" || !candidate.trim() || seen.has(candidate)) return false;
    seen.add(candidate);
  }
  return true;
}

export const equipmentMutationValidator: WorkerMutationValidator = {
  types: ["bodyType.upsert", "bodyType.delete", "bodyType.starting", "equipmentRule.upsert"],
  validate(operation) {
    if (operation.type === "bodyType.upsert") {
      if (!object(operation.bodyType)) return "Body type is invalid.";
      const body = operation.bodyType;
      if (typeof body.id !== "string" || !body.id) return "Body type id is required.";
      if (typeof body.name !== "string" || !body.name.trim()) return "Body type name is required.";
      if (typeof body.assetId !== "string") return "Body type asset reference is invalid.";
      if (!validSlots(body.slots)) return "Body type slots are invalid.";
      const slotKeys = new Set((body.slots as Array<{ key: string }>).map((slot) => slot.key));
      if (!validStartingEquipment(body.startingEquipment, slotKeys)) return "Body type starting equipment is invalid.";
      return null;
    }

    if (operation.type === "bodyType.delete") {
      return typeof operation.id === "string" && operation.id ? null : "Body type id is required.";
    }

    if (operation.type === "bodyType.starting") {
      return operation.id === null || (typeof operation.id === "string" && operation.id)
        ? null
        : "Starting body type id is invalid.";
    }

    if (operation.type === "equipmentRule.upsert") {
      if (!object(operation.rule)) return "Equipment rule is invalid.";
      const rule = operation.rule;
      if (typeof rule.itemId !== "string" || !rule.itemId) return "Equipment rule item is required.";
      if (!validStringSet(rule.slotKeys)) return "Equipment rule slot keys are invalid.";
      if (rule.storage !== "inventory" && rule.storage !== "slot") return "Equipment storage policy is invalid.";
      if (rule.equipOnGiveSlotKey !== null && rule.equipOnGiveSlotKey !== undefined && (
        typeof rule.equipOnGiveSlotKey !== "string" || !rule.equipOnGiveSlotKey.trim()
      )) return "Equipment auto-equip slot is invalid.";
      if (
        typeof rule.equipOnGiveSlotKey === "string"
        && Array.isArray(rule.slotKeys)
        && rule.slotKeys.length > 0
        && !rule.slotKeys.includes(rule.equipOnGiveSlotKey)
      ) return "Equipment auto-equip slot must be one of the allowed slots.";
      return null;
    }

    return null;
  },
};
