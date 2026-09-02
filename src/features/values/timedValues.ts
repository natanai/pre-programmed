import type { PlayState, ProjectSnapshot } from "../../engine/project/model";

const unitSeconds = { second: 1, minute: 60, hour: 3600 } as const;

export function timedValueKey(snapshot: ProjectSnapshot) {
  return JSON.stringify(snapshot.valueDefinitions
    .filter((definition) => definition.valueType === "number" && Number(definition.timeRate ?? 0) !== 0)
    .map((definition) => [definition.id, definition.key, definition.timeRate ?? 0, definition.timeUnit ?? "second"]));
}

export function advanceTimedValues(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  const previous = state.valueTimeUpdatedAt ?? now;
  if (now <= previous) return state.valueTimeUpdatedAt === undefined ? { ...state, valueTimeUpdatedAt: now } : state;
  const elapsedSeconds = (now - previous) / 1000;
  const timed = snapshot.valueDefinitions.filter((definition) =>
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
  return { ...state, values, valueTimeUpdatedAt: now };
}
