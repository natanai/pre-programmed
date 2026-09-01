import type { ProjectMutation, ProjectSnapshot } from "../../engine/project/model";
import {
  listQueuedMutations,
  queueMutation,
  removeQueuedMutation,
  saveCachedSnapshot,
  type QueuedMutation,
} from "../../data/localProject";
import {
  ProjectRevisionConflictError,
  ProjectWriteRejectedError,
  type ProjectPersistence,
} from "../../platform/persistence/projectPersistence";

export type AuthorPersistResult =
  | { status: "saved"; snapshot: ProjectSnapshot }
  | { status: "queued"; snapshot: ProjectSnapshot }
  | { status: "conflict"; snapshot: ProjectSnapshot | null }
  | { status: "failed"; snapshot: ProjectSnapshot | null; message?: string };

export type AuthorLocalPersistence = {
  saveCachedSnapshot(snapshot: ProjectSnapshot): Promise<boolean>;
  queueMutation(mutation: ProjectMutation): Promise<{ id: string; stored: boolean }>;
  removeQueuedMutation(id: string): Promise<void>;
  listQueuedMutations(): Promise<QueuedMutation[]>;
};

const browserLocalPersistence: AuthorLocalPersistence = {
  saveCachedSnapshot,
  queueMutation,
  removeQueuedMutation,
  listQueuedMutations,
};

let synchronizationTail: Promise<void> = Promise.resolve();

async function serializeSynchronization<T>(work: () => Promise<T>) {
  const predecessor = synchronizationTail;
  let release: () => void = () => {};
  synchronizationTail = new Promise<void>((resolve) => { release = resolve; });
  await predecessor;
  try {
    return await work();
  } finally {
    release();
  }
}

function ordered(entries: QueuedMutation[]) {
  return [...entries].sort((left, right) =>
    left.queuedAt.localeCompare(right.queuedAt) || left.id.localeCompare(right.id));
}

async function flushEntries({
  entries,
  persistence,
  authorization,
  local,
}: {
  entries: QueuedMutation[];
  persistence: ProjectPersistence;
  authorization: string;
  local: AuthorLocalPersistence;
}) {
  let snapshot = await persistence.readProject();
  let flushedCount = 0;

  for (const entry of ordered(entries)) {
    const mutation = { ...entry.mutation, expectedRevision: snapshot.revision };
    snapshot = await persistence.writeProject(mutation, { authorization });
    await local.removeQueuedMutation(entry.id);
    flushedCount += 1;
  }

  if (flushedCount) await local.saveCachedSnapshot(snapshot);
  return { snapshot, flushedCount };
}

export async function persistAuthorMutation({
  persistence,
  authorization,
  mutation,
  optimisticSnapshot,
  previousSnapshot,
  local = browserLocalPersistence,
}: {
  persistence: ProjectPersistence;
  authorization: string;
  mutation: ProjectMutation;
  optimisticSnapshot: ProjectSnapshot;
  previousSnapshot: ProjectSnapshot;
  local?: AuthorLocalPersistence;
}): Promise<AuthorPersistResult> {
  return serializeSynchronization(async () => {
    await local.saveCachedSnapshot(optimisticSnapshot);
    const earlier = ordered(await local.listQueuedMutations());
    const queued = await local.queueMutation(mutation);
    let mutationToWrite = mutation;

    try {
      // A later edit may depend on an earlier locally saved resource. Flush
      // those causal predecessors first, then write this mutation against the
      // resulting revision. Never let a recovered connection publish the
      // dependent edit ahead of the resource it references.
      if (earlier.length) {
        const flushed = await flushEntries({ entries: earlier, persistence, authorization, local });
        mutationToWrite = { ...mutation, expectedRevision: flushed.snapshot.revision };
      }

      const snapshot = await persistence.writeProject(mutationToWrite, { authorization });
      if (queued.stored) await local.removeQueuedMutation(queued.id);
      await local.saveCachedSnapshot(snapshot);
      return { status: "saved", snapshot };
    } catch (error) {
      if (error instanceof ProjectRevisionConflictError) {
        if (queued.stored) await local.removeQueuedMutation(queued.id);
        const snapshot = await persistence.readProject().catch(() => null);
        if (snapshot) await local.saveCachedSnapshot(snapshot);
        else await local.saveCachedSnapshot(previousSnapshot);
        return { status: "conflict", snapshot };
      }

      if (error instanceof ProjectWriteRejectedError) {
        if (queued.stored) await local.removeQueuedMutation(queued.id);
        await local.saveCachedSnapshot(previousSnapshot);
        return { status: "failed", snapshot: previousSnapshot, message: error.message };
      }

      if (queued.stored) {
        // flushEntries may have refreshed the cache before this write failed.
        // Restore the complete optimistic view represented by the remaining
        // queue so a reload in this browser does not appear to lose the edit.
        await local.saveCachedSnapshot(optimisticSnapshot);
        return { status: "queued", snapshot: optimisticSnapshot };
      }

      // Neither the hosted store nor the mutation queue accepted this edit. Do
      // not leave an optimistic snapshot in browser cache that cannot be replayed.
      await local.saveCachedSnapshot(previousSnapshot);
      return { status: "failed", snapshot: previousSnapshot };
    }
  });
}

export async function flushQueuedAuthorMutations({
  persistence,
  authorization,
  local = browserLocalPersistence,
}: {
  persistence: ProjectPersistence;
  authorization: string;
  local?: AuthorLocalPersistence;
}) {
  return serializeSynchronization(async () => {
    const entries = await local.listQueuedMutations();
    if (!entries.length) return { snapshot: null, flushedCount: 0 };
    return flushEntries({ entries, persistence, authorization, local });
  });
}
