import type { PlayState, ProjectSnapshot } from "../../engine/project/model";

export function initializeStatePlayState(snapshot: ProjectSnapshot, state: PlayState, now: number): PlayState {
  return {
    ...state,
    values: Object.fromEntries(snapshot.variables.map((definition) => [definition.key, definition.initialValue])),
    variableTimeUpdatedAt: now,
    scopedValues: { node: {} },
  };
}

export function reconcileStatePlayState(snapshot: ProjectSnapshot, state: PlayState, now: number): PlayState {
  return {
    ...state,
    variableTimeUpdatedAt: state.variableTimeUpdatedAt ?? now,
    values: {
      ...Object.fromEntries(snapshot.variables.map((definition) => [definition.key, definition.initialValue])),
      ...state.values,
    },
    scopedValues: {
      node: state.scopedValues?.node ?? {},
    },
  };
}
