import { afterEach, describe, expect, it } from "vitest";
import {
  authorCommitPending,
  authorNavigationAllowed,
  beginAuthorCommit,
  resetAuthorCommitStateForTests,
  withAuthorCommit,
} from "../src/author/tasks/commitState";
import {
  authorResourceDeletionResult,
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
  const stats = { id: "group-id", value: "stats", label: "Stats" };
  const other = { id: "other-id", value: "other", label: "Other" };

  it("derives deletion only from an accepted before/after resource contract", () => {
    expect(authorResourceDeletionResult("state-group", [stats, other], [other])).toEqual({
      type: "resource-deleted",
      kind: "state-group",
      id: "group-id",
      value: "stats",
    });
  });

  it("does not report deletion when the resource survives a reset or when the change is ambiguous", () => {
    expect(authorResourceDeletionResult("media-image", [stats], [stats])).toBeUndefined();
    expect(authorResourceDeletionResult("state-group", [stats, other], [])).toBeUndefined();
  });

  it("does not change a parent reference for failed, conflicted, cancelled, or unrelated child completion", () => {
    expect(reconciledAuthorReferenceValue("state-group", "stats", "group-id", undefined)).toBeUndefined();
    expect(reconciledAuthorReferenceValue("state-group", "stats", "group-id", { type: "saved" })).toBeUndefined();
    expect(reconciledAuthorReferenceValue("state-group", "stats", "group-id", {
      type: "resource-deleted",
      kind: "state-group",
      id: "other-id",
      value: "other",
    })).toBeUndefined();
  });

  it("clears a parent reference only for the matching confirmed deletion result", () => {
    expect(reconciledAuthorReferenceValue("state-group", "stats", "group-id", {
      type: "resource-deleted",
      kind: "state-group",
      id: "group-id",
      value: "stats",
    })).toBe("");
  });

  it("also matches by stable id when a resource value differs from its id", () => {
    expect(reconciledAuthorReferenceValue("variable", "health", "variable-uuid", {
      type: "resource-deleted",
      kind: "variable",
      id: "variable-uuid",
      value: "old-health-key",
    })).toBe("");
  });
});
