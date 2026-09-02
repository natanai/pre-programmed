import type { PlayState, ProjectSnapshot } from "../../engine/project/model";

export function initializeValuesPlayState(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  return {
    ...state,
    values: Object.fromEntries(snapshot.valueDefinitions.map((definition) => [definition.key, structuredClone(definition.initialValue)])),
    valueTimeUpdatedAt: now,
  };
}

export function reconcileValuesPlayState(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  const values = { ...state.values };
  for (const definition of snapshot.valueDefinitions) {
    if (!Object.prototype.hasOwnProperty.call(values, definition.key)) values[definition.key] = structuredClone(definition.initialValue);
  }
  return {
    ...state,
    values,
    valueTimeUpdatedAt: Number.isFinite(state.valueTimeUpdatedAt) ? state.valueTimeUpdatedAt : now,
  };
}
