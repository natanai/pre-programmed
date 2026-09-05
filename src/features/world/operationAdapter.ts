import { authoredSource } from "../../engine/presentation/authoredSource";
import type { AuthorOperationDefinition, OperationTargetAdapter } from "../operations/targetAdapter";

export const WORLD_ENTITY_OPERATION_TARGET_KIND = "world.entity";

/** Location operations remain reusable World behavior; Character dialogue is Node-owned. */
export const WORLD_AUTHOR_OPERATION_DEFINITIONS: readonly AuthorOperationDefinition[] = [
  { value: "inspect", label: "inspect", targetKinds: ["world.location"] },
  { value: "enter", label: "enter", targetKinds: ["world.location"] },
];

export const WORLD_ENTITY_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: WORLD_ENTITY_OPERATION_TARGET_KIND,
  resolve(snapshot, _state, target) {
    const entity = snapshot.entities.find((candidate) => candidate.id === target.id);
    if (!entity) return null;
    if (entity.type === "character") {
      return {
        definitionId: entity.id,
        label: entity.name || entity.key,
        interactable: false,
        operations: [],
        hooks: [],
        authorSource: authoredSource("character", entity.id),
      };
    }
    return {
      definitionId: entity.id,
      label: entity.name || entity.key,
      interactable: entity.interactable ?? false,
      operations: entity.operations ?? [],
      hooks: entity.hooks ?? [],
      authorSource: authoredSource("location", entity.id),
    };
  },
};
