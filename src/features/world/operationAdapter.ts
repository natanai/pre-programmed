import type { OperationTargetAdapter } from "../operations/targetAdapter";

export const WORLD_ENTITY_OPERATION_TARGET_KIND = "world.entity";

/**
 * Characters and locations share one stable runtime target kind. Their World
 * subtype is authored data; changing a character into a location therefore
 * does not orphan operation hooks or require parser/runtime special cases.
 */
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
    };
  },
};
