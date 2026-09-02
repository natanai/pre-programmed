import { describe, expect, it, vi } from "vitest";
import { resolveAuthorCapability } from "../src/author/capabilities/runtime";
import { buildAuthorResourceTools } from "../src/author/resources/runtime";
import { popActiveAuthorTask, setAuthorTaskDirtyState } from "../src/author/tasks/taskStack";
import type { AuthorTaskEntry, AuthorTaskResult } from "../src/author/tasks/types";
import { project } from "./fixtures";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { applyOperations } from "../src/engine/project/mutations";
import { parseCommand } from "../src/features/narrative/parser";
import { executeInteraction } from "../src/features/narrative/runtime";

const parent: AuthorTaskEntry = { id: "parent", route: { type: "tools" }, dirty: true };
const child: AuthorTaskEntry = {
  id: "child",
  route: { type: "feature", feature: "state", workspace: "definitions" },
  dirty: false,
};

describe("Author task stack", () => {
  it("does not manufacture state updates when task dirty state is unchanged", () => {
    const tasks = [parent, child];
    expect(setAuthorTaskDirtyState(tasks, "child", false)).toBe(tasks);
    expect(setAuthorTaskDirtyState(tasks, "missing", true)).toBe(tasks);
    const changed = setAuthorTaskDirtyState(tasks, "child", true);
    expect(changed).not.toBe(tasks);
    expect(changed.map((task) => task.dirty)).toEqual([true, true]);
  });

  it("prevents a suspended task from popping the active child", () => {
    const tasks = [parent, child];
    expect(popActiveAuthorTask(tasks, "parent")).toEqual({ tasks, popped: null });
    const popped = popActiveAuthorTask(tasks, "child");
    expect(popped.popped?.id).toBe("child");
    expect(popped.tasks).toEqual([parent]);
  });

  it("has no depth cap and preserves every suspended parent", () => {
    let tasks: AuthorTaskEntry[] = [parent];
    for (let depth = 1; depth <= 250; depth += 1) {
      tasks = [...tasks, {
        id: `nested-${depth}`,
        route: { type: "feature", feature: `feature-${depth % 3}`, workspace: "editor" },
        dirty: depth % 7 === 0,
      }];
    }
    expect(tasks).toHaveLength(251);
    const popped = popActiveAuthorTask(tasks, "nested-250");
    expect(popped.tasks).toHaveLength(250);
    expect(popped.tasks[0]).toBe(parent);
    expect(popped.tasks.at(-1)?.id).toBe("nested-249");
  });

  it("lets Narrative capture an unmatched phrase even when a player fallback exists", () => {
    const snapshot = project({ interactions: [{
      id: "fallback", sourceNodeId: "a", wording: "", matchMode: "fallback", choiceVisibility: "typed",
      aliases: [], tags: [], notes: "", outcomes: [],
    }] });
    const resolution = resolveAuthorCapability({
      capability: "input.capture-unmatched",
      data: { sourceNodeId: "a", input: "Growl at the moon" },
    }, { snapshot, playState: createEmptyPlayState(snapshot) });
    expect(resolution).toMatchObject({
      type: "mutation",
      operations: [{ type: "interaction.upsert", interaction: {
        wording: "Growl at the moon",
        aliases: ["Growl at the moon"],
        matchMode: "command",
        outcomes: [{ authorStatus: "draft" }],
      } }],
    });
  });

  it("preserves the already-resolved fallback response after capturing the phrase", () => {
    const snapshot = project({ interactions: [{
      id: "fallback", sourceNodeId: "a", wording: "", matchMode: "fallback", choiceVisibility: "typed",
      aliases: [], tags: [], notes: "", outcomes: [{
        id: "fallback-outcome", order: 0, label: "default", authorStatus: "configured", condition: { type: "always" },
        responseText: "The world does not understand yet.", responsePerformance: { charactersPerSecond: 18, cues: [] },
        effects: [], disposition: "stay", destinationNodeId: null,
      }],
    }] });
    const state = createEmptyPlayState(snapshot);
    const parsedBeforeCapture = parseCommand("Growl at the moon", snapshot, state);
    expect(parsedBeforeCapture.reason).toBe("fallback");
    const resolution = resolveAuthorCapability({
      capability: "input.capture-unmatched",
      data: { sourceNodeId: "a", input: "Growl at the moon" },
    }, { snapshot, playState: state });
    expect(resolution?.type).toBe("mutation");
    if (!resolution || resolution.type !== "mutation" || !parsedBeforeCapture.interaction) throw new Error("Expected capture and fallback.");
    const updated = applyOperations(snapshot, resolution.operations);
    const execution = executeInteraction(updated, state, parsedBeforeCapture.interaction);
    expect(execution.responseText).toBe("The world does not understand yet.");
    expect(updated.interactions.some((interaction) => interaction.wording === "Growl at the moon")).toBe(true);
  });

  it("returns a feature-owned resource result through the generic runtime", () => {
    const snapshot = project({
      variables: [{
        id: "health-id", key: "health", label: "Health", valueType: "number", initialValue: 10,
        showInStatus: false, interactable: false, operations: [], hooks: [],
      }],
    });
    let complete: ((result?: AuthorTaskResult) => void) | undefined;
    const pushTask = vi.fn((_route, onComplete) => { complete = onComplete; return "child"; });
    const selected = vi.fn();
    const resources = buildAuthorResourceTools(snapshot, pushTask);

    expect(resources.options("variable")).toEqual([expect.objectContaining({ value: "health", label: "Health" })]);
    resources.create("flag", selected);
    expect(pushTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: "feature", feature: "state", workspace: "definitions" }),
      expect.any(Function),
    );
    complete?.({ type: "resource", kind: "flag", id: "ready-id", value: "ready", label: "Ready" });
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ kind: "flag", value: "ready" }));
  });
});
