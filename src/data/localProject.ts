import type { ProjectMutation, ProjectSnapshot } from "../game/model";

const DB_NAME = "pre-programmed-author";
const DB_VERSION = 1;
const SNAPSHOT_KEY = "project";

export type QueuedMutation = {
  id: string;
  mutation: ProjectMutation;
  queuedAt: string;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("snapshots")) database.createObjectStore("snapshots");
      if (!database.objectStoreNames.contains("mutations")) database.createObjectStore("mutations", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: "snapshots" | "mutations",
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function loadCachedSnapshot() {
  try {
    return (await withStore("snapshots", "readonly", (store) => store.get(SNAPSHOT_KEY))) as
      | ProjectSnapshot
      | undefined;
  } catch {
    return undefined;
  }
}

export async function saveCachedSnapshot(snapshot: ProjectSnapshot) {
  try {
    await withStore("snapshots", "readwrite", (store) => store.put(snapshot, SNAPSHOT_KEY));
    return true;
  } catch {
    // The canonical server remains usable when storage is unavailable or private browsing denies it.
    return false;
  }
}

export async function queueMutation(mutation: ProjectMutation) {
  const queued: QueuedMutation = { id: crypto.randomUUID(), mutation, queuedAt: new Date().toISOString() };
  try {
    await withStore("mutations", "readwrite", (store) => store.put(queued));
    return { id: queued.id, stored: true } as const;
  } catch {
    // Network persistence will still be attempted immediately, but callers must
    // not claim the mutation is queued when browser storage denied the write.
    return { id: queued.id, stored: false } as const;
  }
}

export async function removeQueuedMutation(id: string) {
  try {
    await withStore("mutations", "readwrite", (store) => store.delete(id));
  } catch {
    // A later snapshot synchronization supersedes orphaned local mutations.
  }
}

export async function listQueuedMutations() {
  try {
    return (await withStore("mutations", "readonly", (store) => store.getAll())) as QueuedMutation[];
  } catch {
    return [];
  }
}
