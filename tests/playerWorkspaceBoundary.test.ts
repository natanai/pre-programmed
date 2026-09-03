import { describe, expect, it } from "vitest";
import { APPLICATION_COMMAND_CAPABILITIES } from "../src/engine/application/catalog";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { buildPlayerWorkspaceNavigation, resolvePlayerWorkspace } from "../src/player/workspaces/registry";
import { project } from "./fixtures";

describe("player workspace boundary", () => {
  it("resolves every application workspace capability without entering Author routing", () => {
    for (const capability of APPLICATION_COMMAND_CAPABILITIES) {
      expect(capability.action.type).toBe("open-player-workspace");
      expect(resolvePlayerWorkspace({
        feature: capability.action.feature,
        workspace: capability.action.workspace,
        data: capability.action.data,
      }), capability.operation).toBeDefined();
    }
  });

  it("composes Inventory and visible authored State groups into one player navigation bar", () => {
    const snapshot = project({
      stateGroups: [
        { id: "stats", label: "Stats", order: 0, visibleWhen: { type: "always" } },
        { id: "relationships", label: "Relationships", order: 10, visibleWhen: { type: "flag", key: "met_ada", value: true } },
      ],
      variables: [
        {
          id: "strength", key: "strength", label: "Strength", valueType: "number", initialValue: 5,
          playerPresentation: { groupId: "stats", order: 0, visibleWhen: { type: "always" } },
          interactable: false, operations: [], hooks: [],
        },
        {
          id: "met-ada", key: "met_ada", label: "Met Ada", valueType: "boolean", initialValue: false,
          playerPresentation: null, interactable: false, operations: [], hooks: [],
        },
        {
          id: "ada", key: "ada", label: "Ada", valueType: "number", initialValue: 0,
          playerPresentation: { groupId: "relationships", order: 0, visibleWhen: { type: "always" } },
          interactable: false, operations: [], hooks: [],
        },
      ],
    });
    const playState = createEmptyPlayState(snapshot);
    const navigation = buildPlayerWorkspaceNavigation({
      snapshot,
      playState,
      updateState: () => undefined,
      output: () => undefined,
      events: () => undefined,
    });

    expect(navigation.map((entry) => entry.label)).toEqual(["Inventory", "Stats"]);
    expect(navigation.find((entry) => entry.label === "Stats")?.request)
      .toEqual({ feature: "state", workspace: "status", data: { groupId: "stats" } });
  });
});
