import type { PlayState, ProjectSnapshot } from "../../engine/project/model";

type InventoryAssetState = Pick<PlayState, "bodyBackgroundId" | "inventory">;

function activeBodyTypeId(snapshot: ProjectSnapshot, state?: InventoryAssetState | null) {
  const bodyTypes = snapshot.bodyBackgrounds ?? [];
  const startingId = snapshot.startingBodyBackgroundId ?? null;
  if (!state) return startingId && bodyTypes.some((bodyType) => bodyType.id === startingId) ? startingId : null;

  const hasBodyTypeState = Object.prototype.hasOwnProperty.call(state, "bodyBackgroundId");
  if (!hasBodyTypeState) return startingId && bodyTypes.some((bodyType) => bodyType.id === startingId) ? startingId : null;

  const selectedId = state.bodyBackgroundId ?? null;
  if (selectedId === null) return null;
  if (bodyTypes.some((bodyType) => bodyType.id === selectedId)) return selectedId;
  return startingId && bodyTypes.some((bodyType) => bodyType.id === startingId) ? startingId : null;
}

/**
 * Media that the live Inventory can expose immediately after launch.
 *
 * Inventory owns this selection because it owns body/equipment/carried-item
 * state. The Media system remains the sole owner of resolving and loading the
 * returned stable asset IDs.
 */
export function immediatelyReachableInventoryAssetIds(
  snapshot: ProjectSnapshot,
  state?: InventoryAssetState | null,
) {
  const assetIds = new Set<string>();
  const bodyTypeId = activeBodyTypeId(snapshot, state);
  const bodyType = (snapshot.bodyBackgrounds ?? []).find((candidate) => candidate.id === bodyTypeId);
  if (bodyType?.assetId) assetIds.add(bodyType.assetId);

  const carriedItemIds = state
    ? new Set(state.inventory.map((entry) => entry.itemId))
    : new Set(snapshot.items.filter((item) => item.startingQuantity > 0).map((item) => item.id));

  for (const item of snapshot.items) {
    if (carriedItemIds.has(item.id) && item.assetId) assetIds.add(item.assetId);
  }

  return [...assetIds];
}
