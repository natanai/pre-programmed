import type { PlayState, ProjectSnapshot } from "../engine/project/model";
import type { TextPerformance } from "../features/narrative/model";

const DB_NAME = "pre-programmed-player";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const AUTOSAVE_KEY = "autosave";

export type PersistedTranscriptLine = {
  id: string;
  text: string;
  nodeId?: string;
  speakerId?: string | null;
  command?: boolean;
  artUrl?: string;
};

export type PersistedPlayPresentation = {
  transcript: PersistedTranscriptLine[];
  activeText: string;
  activeNodeId?: string;
  activeSpeakerId: string | null;
  activePerformance: TextPerformance;
  pendingDestinationNodeId: string | null;
};

export type PersistedPlaySession = {
  version: 1;
  schemaVersion: number;
  projectRevision: number;
  savedAt: string;
  playState: PlayState;
  presentation: PersistedPlayPresentation;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SESSION_STORE)) database.createObjectStore(SESSION_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withSessionStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(SESSION_STORE, mode);
    const request = operation(transaction.objectStore(SESSION_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

function isPersistedPlaySession(value: unknown): value is PersistedPlaySession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<PersistedPlaySession>;
  return session.version === 1
    && typeof session.schemaVersion === "number"
    && typeof session.projectRevision === "number"
    && typeof session.savedAt === "string"
    && Boolean(session.playState)
    && Boolean(session.presentation);
}

export async function loadPlaySession() {
  try {
    const value = await withSessionStore("readonly", (store) => store.get(AUTOSAVE_KEY));
    return isPersistedPlaySession(value) ? structuredClone(value) : undefined;
  } catch {
    return undefined;
  }
}

export async function savePlaySession(session: PersistedPlaySession) {
  try {
    await withSessionStore("readwrite", (store) => store.put(structuredClone(session), AUTOSAVE_KEY));
    return true;
  } catch {
    return false;
  }
}

export async function clearPlaySession() {
  try {
    await withSessionStore("readwrite", (store) => store.delete(AUTOSAVE_KEY));
    return true;
  } catch {
    return false;
  }
}

/**
 * Revision changes are allowed: feature-owned reconciliation repairs compatible
 * state after Continue. Schema changes and deleted current nodes require a new
 * game rather than guessing at a migration.
 */
export function isPlaySessionCompatible(snapshot: ProjectSnapshot, session: PersistedPlaySession) {
  return session.schemaVersion === snapshot.schemaVersion
    && snapshot.nodes.some((node) => node.id === session.playState.currentNodeId);
}
