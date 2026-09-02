import type { OperationTargetAdapter } from "../operations/targetAdapter";

export const VALUE_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: "value",
  resolve(snapshot, _state, target) {
    if (target.kind !== "value") return null;
    const definition = snapshot.valueDefinitions.find((candidate) => candidate.id === target.id);
    if (!definition) return null;
    return {
      definitionId: definition.id,
      label: definition.label || definition.key || target.id,
      interactable: definition.interactable ?? false,
      operations: definition.operations ?? [],
      hooks: definition.hooks ?? [],
    };
  },
};

export const DERIVED_VALUE_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: "derived",
  resolve(snapshot, _state, target) {
    if (target.kind !== "derived") return null;
    const definition = snapshot.derivedValueDefinitions.find((candidate) => candidate.id === target.id);
    if (!definition) return null;
    return {
      definitionId: definition.id,
      label: definition.label || definition.key || target.id,
      interactable: definition.interactable ?? false,
      operations: definition.operations ?? [],
      hooks: definition.hooks ?? [],
    };
  },
};
