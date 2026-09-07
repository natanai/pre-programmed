import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthorWorkspaceContext } from "../src/author/features/types";
import {
  authorCommitPending,
  authorNavigationAllowed,
  beginAuthorCommit,
  resetAuthorCommitStateForTests,
  withAuthorCommit,
} from "../src/author/tasks/commitState";
import {
  completeAuthorResourceDeletion,
  reconciledAuthorReferenceValue,
} from "../src/author/resources/completion";

afterEach(() => resetAuthorCommitStateForTests());

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("Author durable commit lock", () => {
  it("blocks user navigation until a deferred durable operation settles", async () => {
    const write = deferred<string>();
    const pending = withAuthorCommit(() => write.promise);

    expect(authorCommitPending()).toBe(true);
    expect(authorNavigationAllowed()).toBe(false);

    write.resolve("saved");
    await expect(pending).resolves.toBe("saved");

    expect(authorCommitPending()).toBe(false);
    expect(authorNavigationAllowed()).toBe(true);
  });

  it("stays locked until overlapping outer and inner commit scopes both finish", () => {
    const releaseOuter = beginAuthorCommit();
    const releaseInner = beginAuthorCommit();

    expect(authorNavigationAllowed()).toBe(false);
    releaseInner();
    expect(authorNavigationAllowed()).toBe(false);
    releaseOuter();
    expect(authorNavigationAllowed()).toBe(true);
  });
});

describe("Author resource deletion completion", () => {
  it("does not change a parent reference for failed, conflicted, cancelled, or unrelated child completion", () => {
    expect(reconciledAuthorReferenceValue("state-group", "stats", undefined)).toBeUndefined();
    expect(reconciledAuthorReferenceValue("state-group", "stats", { type: "saved" })).toBeUndefined();
    expect(reconciledAuthorReferenceValue("state-group", "stats", {
      type: "resource-deleted",
      kind: "state-group",
      id: "other",
    })).toBeUndefined();
  });

  it("clears a parent reference only for the matching confirmed deletion result", () => {
    expect(reconciledAuthorReferenceValue("state-group", "stats", {
      type: "resource-deleted",
      kind: "state-group",
      id: "stats",
    })).toBe("");
  });

  it("returns a typed deletion result from a nested owner and preserves root completion behavior", () => {
    const nestedComplete = vi.fn();
    const nestedLeave = vi.fn();
    const nestedContext = {
      hasParentTask: true,
      completeTask: nestedComplete,
      leaveCurrentTask: nestedLeave,
    } as unknown as AuthorWorkspaceContext;

    completeAuthorResourceDeletion(nestedContext, "state-group", "stats");
    expect(nestedComplete).toHaveBeenCalledTimes(1);
    expect(nestedComplete).toHaveBeenCalledWith({
      type: "resource-deleted",
      kind: "state-group",
      id: "stats",
    });
    expect(nestedLeave).not.toHaveBeenCalled();

    const rootComplete = vi.fn();
    const rootLeave = vi.fn();
    const rootContext = {
      hasParentTask: false,
      completeTask: rootComplete,
      leaveCurrentTask: rootLeave,
    } as unknown as AuthorWorkspaceContext;

    completeAuthorResourceDeletion(rootContext, "state-group", "stats");
    expect(rootComplete).not.toHaveBeenCalled();
    expect(rootLeave).toHaveBeenCalledTimes(1);
  });
});
