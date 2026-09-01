import { describe, expect, it } from "vitest";
import {
  advanceProjectClocks,
  hasActiveProjectClock,
  projectClockScheduleKey,
  resetProjectClocks,
} from "../src/engine/runtime/projectClock";
import { createEmptyPlayState } from "../src/game/model";
import { project } from "./fixtures";

describe("project clock composition", () => {
  it("keeps State timing semantics behind the generic clock boundary", () => {
    const untimed = project({ variables: [] });
    expect(hasActiveProjectClock(untimed)).toBe(false);

    const timed = project({ variables: [{
      id: "drain",
      key: "drain",
      label: "Drain",
      valueType: "number",
      initialValue: 10,
      showInStatus: false,
      interactable: false,
      operations: [],
      hooks: [],
      timeRate: -2,
      timeUnit: "minute",
    }] });
    expect(hasActiveProjectClock(timed)).toBe(true);
    expect(projectClockScheduleKey(timed)).not.toBe(projectClockScheduleKey(untimed));

    const initial = createEmptyPlayState(timed, 1_000);
    const reset = resetProjectClocks(timed, initial, 1_000);
    const advanced = advanceProjectClocks(timed, reset, 61_000);
    expect(advanced.values.drain).toBe(8);
    expect(advanced.variableTimeUpdatedAt).toBe(61_000);
  });
});
