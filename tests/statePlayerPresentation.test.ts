import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import type { ProjectSnapshot } from "../src/engine/project/model";
import { visibleStateGroups } from "../src/features/state/playerPresentation";
import { project } from "./fixtures";

function stateProject(): ProjectSnapshot {
  return project({
    stateGroups: [
      { id: "attributes", label: "Attributes", order: 20, visibleWhen: { type: "always" } },
      { id: "relationships", label: "Relationships", order: 10, visibleWhen: { type: "flag", key: "knows_ada", value: true } },
    ],
    variables: [
      {
        id: "knows-ada", key: "knows_ada", label: "Knows Ada", valueType: "boolean", initialValue: false,
        playerPresentation: null, interactable: false, operations: [], hooks: [],
      },
      {
        id: "show-name", key: "show_name", label: "Show Name", valueType: "boolean", initialValue: false,
        playerPresentation: null, interactable: false, operations: [], hooks: [],
      },
      {
        id: "secret", key: "secret", label: "Secret", valueType: "number", initialValue: 99,
        playerPresentation: null, interactable: false, operations: [], hooks: [],
      },
      {
        id: "health", key: "health", label: "Health", valueType: "number", initialValue: 80,
        playerPresentation: { groupId: "attributes", order: 20, visibleWhen: { type: "always" } },
        interactable: false, operations: [], hooks: [],
      },
      {
        id: "name", key: "name", label: "Name", valueType: "string", initialValue: "Morgan",
        playerPresentation: { groupId: "attributes", order: 10, visibleWhen: { type: "flag", key: "show_name", value: true } },
        interactable: false, operations: [], hooks: [],
      },
      {
        id: "friendship", key: "friendship", label: "Ada", valueType: "number", initialValue: 3,
        playerPresentation: { groupId: "relationships", order: 0, visibleWhen: { type: "always" } },
        interactable: false, operations: [], hooks: [],
      },
    ],
  });
}

describe("State player presentation", () => {
  it("keeps internal values hidden and honors group and entry conditions", () => {
    const snapshot = stateProject();
    const initial = createEmptyPlayState(snapshot, 1_000);

    const before = visibleStateGroups(snapshot, initial, 2_000);
    expect(before.map(({ group }) => group.label)).toEqual(["Attributes"]);
    expect(before[0]?.entries.map(({ definition }) => definition.label)).toEqual(["Health"]);
    expect(before.flatMap(({ entries }) => entries.map(({ definition }) => definition.label))).not.toContain("Secret");

    const revealed = {
      ...initial,
      values: { ...initial.values, knows_ada: true, show_name: true },
    };
    const after = visibleStateGroups(snapshot, revealed, 2_000);

    expect(after.map(({ group }) => group.label)).toEqual(["Relationships", "Attributes"]);
    expect(after[0]?.entries.map(({ definition }) => definition.label)).toEqual(["Ada"]);
    expect(after[1]?.entries.map(({ definition }) => definition.label)).toEqual(["Name", "Health"]);
  });

  it("uses authored group and entry order independently of labels", () => {
    const snapshot = stateProject();
    const state = createEmptyPlayState(snapshot, 1_000);
    state.values.knows_ada = true;
    state.values.show_name = true;

    const visible = visibleStateGroups(snapshot, state, 2_000);
    expect(visible.map(({ group }) => group.id)).toEqual(["relationships", "attributes"]);
    expect(visible.find(({ group }) => group.id === "attributes")?.entries.map(({ definition }) => definition.id))
      .toEqual(["name", "health"]);
  });
});
