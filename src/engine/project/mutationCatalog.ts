import { EQUIPMENT_MUTATION_HANDLERS } from "../../features/equipment/mutationRuntime";
import { INVENTORY_MUTATION_HANDLERS } from "../../features/inventory/mutationRuntime";
import { MEDIA_MUTATION_HANDLERS } from "../../features/media/mutationRuntime";
import { NARRATIVE_MUTATION_HANDLERS } from "../../features/narrative/mutationRuntime";
import { STATUS_MUTATION_HANDLERS } from "../../features/status/mutationRuntime";
import { VALUES_MUTATION_HANDLERS } from "../../features/values/mutationRuntime";
import { WORLD_MUTATION_HANDLERS } from "../../features/world/mutationRuntime";
import type { MutationHandler } from "./mutationRuntime";

const projectSettings: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "project.settings") return;
  snapshot.settings = structuredClone(operation.settings);
};

export const MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "project.settings": projectSettings,
  ...NARRATIVE_MUTATION_HANDLERS,
  ...WORLD_MUTATION_HANDLERS,
  ...VALUES_MUTATION_HANDLERS,
  ...STATUS_MUTATION_HANDLERS,
  ...INVENTORY_MUTATION_HANDLERS,
  ...EQUIPMENT_MUTATION_HANDLERS,
  ...MEDIA_MUTATION_HANDLERS,
};
