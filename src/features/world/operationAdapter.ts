import { authoredSource } from "../../engine/presentation/authoredSource";
import type { OperationTargetAdapter } from "../operations/targetAdapter";
import { characterNameForPresentation } from "./playState";

export const WORLD_ENTITY_OPERATION_TARGET_KIND = "world.entity";

export const WORLD_ENTITY_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: WORLD_ENTITY_OPERATION_TARGET_KIND,
  resolve(snapshot, state, target) {
    const entity = snapshot.entities.find((candidate) => candidate.id === target.id);
    if (!entity) return null;
    return {
      definitionId: entity.id,
      label: entity.type === "character"
        ? characterNameForPresentation(entity, state, false, snapshot)
        : entity.name || entity.key,
      interactable: entity.interactable ?? false,
      operations: entity.operations ?? [],
      hooks: entity.hooks ?? [],
      authorSource: authoredSource(entity.type, entity.id),
    };
  },
};
