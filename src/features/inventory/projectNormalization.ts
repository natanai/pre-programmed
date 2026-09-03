import type { MutationOperation } from "../../engine/project/model";
import { normalizeBodyTypeDefinition, type LegacyBodyTypeDefinition } from "./bodyCanvas";
import type { BodyBackgroundDefinition } from "./model";
import type { InventoryProjectSlice } from "./projectSlice";

type InventorySnapshotLike = {
  bodyBackgrounds?: unknown;
  startingBodyBackgroundId?: unknown;
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

/**
 * One-way browser-cache boundary for Inventory-owned project state.
 * Durable D1 rows are migrated separately; active runtime code only receives
 * Body Types with the current logical-canvas contract.
 */
export function normalizeInventoryProjectSlice(snapshot: InventorySnapshotLike): Pick<InventoryProjectSlice, "bodyBackgrounds" | "startingBodyBackgroundId"> {
  const bodyBackgrounds = Array.isArray(snapshot.bodyBackgrounds)
    ? snapshot.bodyBackgrounds.filter(legacyBodyType).map((bodyType) => normalizeBodyTypeDefinition(bodyType))
    : [];
  const requestedStartingId = typeof snapshot.startingBodyBackgroundId === "string"
    ? snapshot.startingBodyBackgroundId
    : null;
  return {
    bodyBackgrounds,
    startingBodyBackgroundId: requestedStartingId && bodyBackgrounds.some((bodyType) => bodyType.id === requestedStartingId)
      ? requestedStartingId
      : null,
  };
}

/**
 * Upgrade an Inventory mutation recovered from browser storage before replay.
 * This exists only so an offline pre-migration Body edit is not stranded when
 * the current Worker correctly requires the logical-canvas payload.
 */
export function normalizeInventoryMutationOperation(operation: MutationOperation): MutationOperation {
  if (operation.type !== "bodyBackground.upsert") return operation;
  return {
    ...operation,
    background: normalizeBodyTypeDefinition(operation.background as LegacyBodyTypeDefinition),
  };
}
