import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const bodyTypeUpsert: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "bodyType.upsert") return;
  snapshot.bodyTypes = upsertById(snapshot.bodyTypes, operation.bodyType);
};
const bodyTypeDelete: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "bodyType.delete") return;
  snapshot.bodyTypes = snapshot.bodyTypes.filter((bodyType) => bodyType.id !== operation.id);
  if (snapshot.startingBodyTypeId === operation.id) snapshot.startingBodyTypeId = null;
};
const bodyTypeStarting: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "bodyType.starting") return;
  snapshot.startingBodyTypeId = operation.id;
};
const ruleUpsert: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "equipmentRule.upsert") return;
  snapshot.equipmentRules = snapshot.equipmentRules.some((rule) => rule.itemId === operation.rule.itemId)
    ? snapshot.equipmentRules.map((rule) => rule.itemId === operation.rule.itemId ? operation.rule : rule)
    : [...snapshot.equipmentRules, operation.rule];
};

export const EQUIPMENT_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "bodyType.upsert": bodyTypeUpsert,
  "bodyType.delete": bodyTypeDelete,
  "bodyType.starting": bodyTypeStarting,
  "equipmentRule.upsert": ruleUpsert,
};
