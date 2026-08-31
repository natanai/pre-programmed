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
  | { status: "failed"; snapshot: ProjectSnapshot };

export async function persistAuthorMutation({
  persistence,
  authorization,
  mutation,
  optimisticSnapshot,
}: {
  persistence: ProjectPersistence;
  authorization: string;
  mutation: ProjectMutation;
  optimisticSnapshot: ProjectSnapshot;
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
      return { status: "conflict", snapshot };
    }

    if (queued.stored) {
      return { status: "queued", snapshot: optimisticSnapshot };
    }

    return { status: "failed", snapshot: optimisticSnapshot };
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
