import type { ProjectClockContribution } from "../../engine/runtime/projectClockContract";
import { advanceTimedVariables, timedVariableKey } from "./timedVariables";

/** State owns the real-time clock used by time-changing variables. */
export const stateProjectClock: ProjectClockContribution = {
  id: "state",
  scheduleKey: timedVariableKey,
  active(snapshot) {
    return timedVariableKey(snapshot) !== "[]";
  },
  reset(_snapshot, state, now) {
    return { ...state, variableTimeUpdatedAt: now };
  },
  advance(snapshot, state, now) {
    return advanceTimedVariables(snapshot, state, now);
  },
};
