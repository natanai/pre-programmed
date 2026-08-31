import type { ProjectMutation, ProjectSnapshot } from "../../engine/project/model";
import {
  listQueuedMutations,
  queueMutation,
  removeQueuedMutation,
  saveCachedSnapshot,
} from "../../data/localProject";
import {
  ProjectRevisionConflictError,
  type ProjectPersistence,
} from "../../platform/persistence/projectPersistence";

export type AuthorPersistResult =
  | { status: "saved"; snapshot: ProjectSnapshot }
  | { status: "queued"; snapshot: ProjectSnapshot }
  | { status: "conflict"; snapshot: ProjectSnapshot | null }
  | { status: "failed"; snapshot: ProjectSnapshot | null };

export async function persistAuthorMutation({
  persistence,
  authorization,
  mutation,
  optimisticSnapshot,
  previousSnapshot,
}: {
  persistence: ProjectPersistence;
  authorization: string;
  mutation: ProjectMutation;
  optimisticSnapshot: ProjectSnapshot;
  previousSnapshot: ProjectSnapshot;
}): Promise<AuthorPersistResult> {
  await saveCachedSnapshot(optimisticSnapshot);
  const queued = await queueMutation(mutation);

  try {
    const snapshot = await persistence.writeProject(mutation, { authorization });
    if (queued.stored) await removeQueuedMutation(queued.id);
    await saveCachedSnapshot(snapshot);
    return { status: "saved", snapshot };
  } catch (error) {
    if (error instanceof ProjectRevisionConflictError) {
      if (queued.stored) await removeQueuedMutation(queued.id);
      const snapshot = await persistence.readProject().catch(() => null);
      if (snapshot) await saveCachedSnapshot(snapshot);
      else await saveCachedSnapshot(previousSnapshot);
      return { status: "conflict", snapshot };
    }

    if (queued.stored) {
      return { status: "queued", snapshot: optimisticSnapshot };
    }

    // Neither the hosted store nor the mutation queue accepted this edit. Do
    // not leave an optimistic snapshot in browser cache that cannot be replayed.
    await saveCachedSnapshot(previousSnapshot);
    return { status: "failed", snapshot: previousSnapshot };
  }
}

export async function flushQueuedAuthorMutations({
  persistence,
  authorization,
}: {
  persistence: ProjectPersistence;
  authorization: string;
}) {
  const queued = (await listQueuedMutations())
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
  let snapshot = await persistence.readProject();
  let flushedCount = 0;

  for (const entry of queued) {
    const mutation = { ...entry.mutation, expectedRevision: snapshot.revision };
    snapshot = await persistence.writeProject(mutation, { authorization });
    await removeQueuedMutation(entry.id);
    flushedCount += 1;
  }

  if (flushedCount) await saveCachedSnapshot(snapshot);
  return { snapshot, flushedCount };
}
