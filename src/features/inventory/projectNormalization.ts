import type { MutationOperation } from "../../engine/project/model";
import { normalizeBodyTypeDefinition, type LegacyBodyTypeDefinition } from "./bodyCanvas";
import type { BodyBackgroundDefinition, EquipmentPlacementDefinition, ItemDefinition } from "./model";
import type { InventoryProjectSlice } from "./projectSlice";

type InventorySnapshotLike = {
  items?: unknown;
  bodyBackgrounds?: unknown;
  startingBodyBackgroundId?: unknown;
};

type LegacyItemDefinition = ItemDefinition & {
  equipmentSlotKeys?: unknown;
  equipmentPlacements?: unknown;
};

function legacyBodyType(value: unknown): value is LegacyBodyTypeDefinition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BodyBackgroundDefinition>;
  return typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && typeof candidate.assetId === "string"
    && (candidate.slots === undefined || Array.isArray(candidate.slots))
    && (candidate.startingEquipment === undefined || Array.isArray(candidate.startingEquipment));
}

function normalizeEquipmentPlacements(value: unknown, legacySlotKeys: unknown): EquipmentPlacementDefinition[] {
  if (Array.isArray(value)) {
    const anchors = new Set<string>();
    return value.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
      const placement = candidate as Partial<EquipmentPlacementDefinition>;
      if (typeof placement.anchorSlotKey !== "string" || !placement.anchorSlotKey.trim() || anchors.has(placement.anchorSlotKey)) return [];
      const occupied = Array.isArray(placement.occupiedSlotKeys)
        ? placement.occupiedSlotKeys.filter((key): key is string => typeof key === "string" && Boolean(key.trim()))
        : [];
      const anchorSlotKey = placement.anchorSlotKey.trim();
      anchors.add(anchorSlotKey);
      return [{ anchorSlotKey, occupiedSlotKeys: [...new Set([anchorSlotKey, ...occupied])] }];
    });
  }
  if (!Array.isArray(legacySlotKeys)) return [];
  return legacySlotKeys
    .filter((key): key is string => typeof key === "string" && Boolean(key.trim()))
    .map((key) => ({ anchorSlotKey: key.trim(), occupiedSlotKeys: [key.trim()] }));
}

function normalizeItemDefinition(value: unknown): ItemDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as LegacyItemDefinition;
  if (typeof candidate.id !== "string" || typeof candidate.key !== "string" || typeof candidate.name !== "string") return null;
  return {
    ...candidate,
    equipmentPlacements: normalizeEquipmentPlacements(candidate.equipmentPlacements, candidate.equipmentSlotKeys),
    equippedStorage: candidate.equippedStorage === "slot" ? "slot" : "inventory",
    equipOnGiveSlotKey: typeof candidate.equipOnGiveSlotKey === "string" ? candidate.equipOnGiveSlotKey : null,
  };
}

/**
 * One-way browser-cache boundary for Inventory-owned project state.
 * Durable D1 rows are migrated separately; active runtime code only receives
 * Body Types and equipment items using current contracts.
 */
export function normalizeInventoryProjectSlice(snapshot: InventorySnapshotLike): Pick<InventoryProjectSlice, "items" | "bodyBackgrounds" | "startingBodyBackgroundId"> {
  const items = Array.isArray(snapshot.items)
    ? snapshot.items.flatMap((item) => {
      const normalized = normalizeItemDefinition(item);
      return normalized ? [normalized] : [];
    })
    : [];
  const bodyBackgrounds = Array.isArray(snapshot.bodyBackgrounds)
    ? snapshot.bodyBackgrounds.filter(legacyBodyType).map((bodyType) => normalizeBodyTypeDefinition(bodyType))
    : [];
  const requestedStartingId = typeof snapshot.startingBodyBackgroundId === "string"
    ? snapshot.startingBodyBackgroundId
    : null;
  return {
    items,
    bodyBackgrounds,
    startingBodyBackgroundId: requestedStartingId && bodyBackgrounds.some((bodyType) => bodyType.id === requestedStartingId)
      ? requestedStartingId
      : null,
  };
}

/**
 * Upgrade Inventory mutations recovered from browser storage before replay.
 * This exists only so offline pre-migration edits are not stranded when the
 * current Worker requires logical Body canvases and placement-based equipment.
 */
export function normalizeInventoryMutationOperation(operation: MutationOperation): MutationOperation {
  if (operation.type === "bodyBackground.upsert") {
    return {
      ...operation,
      background: normalizeBodyTypeDefinition(operation.background as LegacyBodyTypeDefinition),
    };
  }
  if (operation.type === "item.upsert") {
    const normalized = normalizeItemDefinition(operation.item as LegacyItemDefinition);
    return normalized ? { ...operation, item: normalized } : operation;
  }
  return operation;
}
