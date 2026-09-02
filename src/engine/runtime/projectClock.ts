import { valuesProjectClock } from "../../features/values/projectClock";
import type { PlayState, ProjectSnapshot } from "../project/model";
import type { ProjectClockContribution } from "./projectClockContract";

const PROJECT_CLOCKS: readonly ProjectClockContribution[] = [valuesProjectClock];
export function projectClockScheduleKey(snapshot: ProjectSnapshot) { return JSON.stringify(PROJECT_CLOCKS.map((clock) => [clock.id, clock.scheduleKey(snapshot)])); }
export function hasActiveProjectClock(snapshot: ProjectSnapshot) { return PROJECT_CLOCKS.some((clock) => clock.active(snapshot)); }
export function resetProjectClocks(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState { return PROJECT_CLOCKS.reduce((next, clock) => clock.reset(snapshot, next, now), state); }
export function advanceProjectClocks(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState { return PROJECT_CLOCKS.reduce((next, clock) => clock.active(snapshot) ? clock.advance(snapshot, next, now) : next, state); }
