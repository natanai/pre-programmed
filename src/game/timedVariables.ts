import type { PlayState, ProjectSnapshot } from "./model";

const unitSeconds = { second: 1, minute: 60, hour: 3600 } as const;

export function timedVariableKey(snapshot: ProjectSnapshot) {
  return JSON.stringify(snapshot.variables
    .filter((definition) => definition.valueType === "number" && Number(definition.timeRate ?? 0) !== 0)
    .map((definition) => [definition.id, definition.key, definition.timeRate ?? 0, definition.timeUnit ?? "second"]));
}

export function advanceTimedVariables(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  const previous = state.variableTimeUpdatedAt ?? now;
  if (now <= previous) return state.variableTimeUpdatedAt === undefined ? { ...state, variableTimeUpdatedAt: now } : state;

  const elapsedSeconds = (now - previous) / 1000;
  const timed = snapshot.variables.filter((definition) =>
    definition.valueType === "number" && Number.isFinite(definition.timeRate) && Number(definition.timeRate) !== 0,
  );
  if (!timed.length) return state;

  const values = { ...state.values };
  for (const definition of timed) {
    const current = values[definition.key];
    const initial = definition.initialValue;
    const number = typeof current === "number" ? current : typeof initial === "number" ? initial : 0;
    const unit = definition.timeUnit ?? "second";
    values[definition.key] = number + (Number(definition.timeRate) * elapsedSeconds / unitSeconds[unit]);
  }
  return { ...state, values, variableTimeUpdatedAt: now };
}
