import { authoredSource } from "../../engine/presentation/authoredSource";
import type { AuthorOperationDefinition, OperationTargetAdapter } from "../operations/targetAdapter";

export const WORLD_ENTITY_OPERATION_TARGET_KIND = "world.entity";

/** World entities expose reusable operations; Character dialogue remains Node-owned. */
export const WORLD_AUTHOR_OPERATION_DEFINITIONS: readonly AuthorOperationDefinition[] = [
  { value: "inspect", label: "inspect", targetKinds: ["world.character", "world.location"] },
  { value: "enter", label: "enter", targetKinds: ["world.location"] },
];

export const WORLD_ENTITY_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: WORLD_ENTITY_OPERATION_TARGET_KIND,
  resolve(snapshot, _state, target) {
    const entity = snapshot.entities.find((candidate) => candidate.id === target.id);
    if (!entity) return null;
    return {
      definitionId: entity.id,
      label: entity.name || entity.key,
      interactable: entity.interactable ?? false,
      operations: entity.operations ?? [],
      hooks: entity.hooks ?? [],
      authorSource: authoredSource(entity.type, entity.id),
    };
  },
};
