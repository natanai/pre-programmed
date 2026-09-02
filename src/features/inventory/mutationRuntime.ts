import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const itemUpsert: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "item.upsert") return;
  snapshot.items = upsertById(snapshot.items, operation.item);
};
const itemDelete: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "item.delete") return;
  snapshot.items = snapshot.items.filter((item) => item.id !== operation.id);
  snapshot.itemInventoryLayouts = snapshot.itemInventoryLayouts.filter((layout) => layout.itemId !== operation.id);
};
const layoutUpsert: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "itemInventoryLayout.upsert") return;
  snapshot.itemInventoryLayouts = snapshot.itemInventoryLayouts.some((layout) => layout.itemId === operation.layout.itemId)
    ? snapshot.itemInventoryLayouts.map((layout) => layout.itemId === operation.layout.itemId ? operation.layout : layout)
    : [...snapshot.itemInventoryLayouts, operation.layout];
};
const presentationUpsert: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "inventoryPresentation.upsert") return;
  snapshot.inventoryPresentation = structuredClone(operation.presentation);
};

export const INVENTORY_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "item.upsert": itemUpsert,
  "item.delete": itemDelete,
  "itemInventoryLayout.upsert": layoutUpsert,
  "inventoryPresentation.upsert": presentationUpsert,
};
