import { describe, expect, it, vi } from "vitest";
import { buildAuthorResourceTools } from "../src/author/resources/runtime";
import { popActiveAuthorTask, setAuthorTaskDirtyState } from "../src/author/tasks/taskStack";
import type { AuthorTaskEntry, AuthorTaskResult } from "../src/author/tasks/types";
import { project } from "./fixtures";

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
