import type { OperationTargetAdapter } from "../operations/targetAdapter";

export const VARIABLE_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: "variable",
  resolve(snapshot, _state, target) {
    if (target.kind !== "variable") return null;
    const definition = snapshot.variables.find((candidate) => candidate.id === target.id);
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

export const COMPUTED_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: "computed",
  resolve(snapshot, _state, target) {
    if (target.kind !== "computed") return null;
    const definition = snapshot.computedValues.find((candidate) => candidate.id === target.id);
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
