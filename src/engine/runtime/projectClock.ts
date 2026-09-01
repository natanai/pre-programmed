import { stateProjectClock } from "../../features/state/projectClock";
import type { PlayState, ProjectSnapshot } from "../project/model";
import type { ProjectClockContribution } from "./projectClockContract";

/** Explicit composition root for installed real-time project clocks. */
const PROJECT_CLOCKS: readonly ProjectClockContribution[] = [
  stateProjectClock,
];

export function projectClockScheduleKey(snapshot: ProjectSnapshot) {
  return JSON.stringify(PROJECT_CLOCKS.map((clock) => [clock.id, clock.scheduleKey(snapshot)]));
}

export function hasActiveProjectClock(snapshot: ProjectSnapshot) {
  return PROJECT_CLOCKS.some((clock) => clock.active(snapshot));
}

export function resetProjectClocks(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  return PROJECT_CLOCKS.reduce((nextState, clock) => clock.reset(snapshot, nextState, now), state);
}

export function advanceProjectClocks(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  return PROJECT_CLOCKS.reduce(
    (nextState, clock) => clock.active(snapshot) ? clock.advance(snapshot, nextState, now) : nextState,
    state,
  );
}
