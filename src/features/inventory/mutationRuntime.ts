import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertItem: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "item.upsert") return;
  snapshot.items = upsertById(snapshot.items, operation.item);
};

const deleteItem: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "item.delete") return;
  snapshot.items = snapshot.items.filter((item) => item.id !== operation.id);
  snapshot.bodyBackgrounds = (snapshot.bodyBackgrounds ?? []).map((bodyType) => ({
    ...bodyType,
    startingEquipment: (bodyType.startingEquipment ?? []).filter((entry) => entry.itemId !== operation.id),
  }));
};

const upsertBodyBackground: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "bodyBackground.upsert") return;
  snapshot.bodyBackgrounds = upsertById(snapshot.bodyBackgrounds ?? [], operation.background);
};

const deleteBodyBackground: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "bodyBackground.delete") return;
  snapshot.bodyBackgrounds = (snapshot.bodyBackgrounds ?? []).filter((background) => background.id !== operation.id);
  if (snapshot.startingBodyBackgroundId === operation.id) snapshot.startingBodyBackgroundId = null;
};

const setStartingBodyBackground: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "bodyBackground.starting") return;
  snapshot.startingBodyBackgroundId = operation.id;
};

export const INVENTORY_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "item.upsert": upsertItem,
  "item.delete": deleteItem,
  "bodyBackground.upsert": upsertBodyBackground,
  "bodyBackground.delete": deleteBodyBackground,
  "bodyBackground.starting": setStartingBodyBackground,
};
