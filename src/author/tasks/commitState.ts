import { useSyncExternalStore } from "react";

let pendingCommits = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while any Author-owned durable operation is in flight. */
export function authorCommitPending() {
  return pendingCommits > 0;
}

/**
 * Begin one durable Author operation.
 *
 * The counter intentionally supports overlapping wrappers: a structured Save
 * may own the whole task commit while its feature persistence call is also
 * wrapped. Navigation remains locked until the outermost durable operation has
 * finished and task completion has had a chance to return to its parent.
 */
export function beginAuthorCommit() {
  pendingCommits += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pendingCommits = Math.max(0, pendingCommits - 1);
    emit();
  };
}

export async function withAuthorCommit<T>(work: () => Promise<T>): Promise<T> {
  const release = beginAuthorCommit();
  try {
    return await work();
  } finally {
    release();
  }
}

/** Runtime safety gate beneath presentation-level disabled/inert controls. */
export function authorNavigationAllowed() {
  return !authorCommitPending();
}

export function useAuthorCommitPending() {
  return useSyncExternalStore(subscribe, authorCommitPending, () => false);
}

/** Test-only reset for module-global state between isolated unit tests. */
export function resetAuthorCommitStateForTests() {
  pendingCommits = 0;
  emit();
}
