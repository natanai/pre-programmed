import type { ProjectClockContribution } from "../../engine/runtime/projectClockContract";
import { advanceTimedValues, timedValueKey } from "./timedValues";

export const valuesProjectClock: ProjectClockContribution = {
  id: "values",
  scheduleKey: timedValueKey,
  active(snapshot) {
    return timedValueKey(snapshot) !== "[]";
  },
  reset(_snapshot, state, now) {
    return { ...state, valueTimeUpdatedAt: now };
  },
  advance(snapshot, state, now) {
    return advanceTimedValues(snapshot, state, now);
  },
};
