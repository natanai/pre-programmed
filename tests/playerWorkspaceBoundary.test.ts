import { describe, expect, it } from "vitest";
import { APPLICATION_COMMAND_CAPABILITIES } from "../src/engine/application/catalog";
import { resolvePlayerWorkspace } from "../src/player/workspaces/registry";

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
});
