import type { AuthoredSourceIdentity } from "../engine/presentation/authoredSource";
import type { PlayState, ProjectSnapshot } from "../engine/project/model";
import type { TextPerformance } from "../features/narrative/model";

const DB_NAME = "pre-programmed-player";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const AUTOSAVE_KEY = "autosave";
export const PLAY_SESSION_VERSION = 2 as const;

export type PersistedTranscriptLine = {
  id: string;
  text: string;
  nodeId?: string;
  speakerId?: string | null;
  command?: boolean;
  /** Stable media identity. Content location is resolved when the line renders. */
  artAssetId?: string;
  /** Optional durable source identity used only to augment live presentation in Author mode. */
  source?: AuthoredSourceIdentity;
};

export type PersistedPlayPresentation = {
  transcript: PersistedTranscriptLine[];
  activeText: string;
  activeNodeId?: string;
  activeSpeakerId: string | null;
  activePerformance: TextPerformance;
  pendingDestinationNodeId: string | null;
  activeSource?: AuthoredSourceIdentity;
};

export type PersistedPlaySession = {
  version: typeof PLAY_SESSION_VERSION;
  schemaVersion: number;
  projectRevision: number;
  savedAt: string;
  playState: PlayState;
  presentation: PersistedPlayPresentation;
  /** Imported file saves use this once so reload resumes them without a second prompt. */
  resumeImmediately?: boolean;
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

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeSource(value: unknown): AuthoredSourceIdentity | undefined {
  if (!object(value) || typeof value.resourceKind !== "string" || typeof value.resourceId !== "string") return undefined;
  const focus = object(value.focus)
    ? Object.fromEntries(Object.entries(value.focus).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : undefined;
  return {
    resourceKind: value.resourceKind,
    resourceId: value.resourceId,
    ...(focus && Object.keys(focus).length ? { focus } : {}),
  };
}

function normalizeTranscriptLine(value: unknown): PersistedTranscriptLine | null {
  if (!object(value) || typeof value.id !== "string" || typeof value.text !== "string") return null;

  // v1 stored resolved storage URLs. There is no safe way to recover stable identity
  // from an arbitrary old URL, so discard only those obsolete presentation-only lines.
  if (typeof value.artUrl === "string" && typeof value.artAssetId !== "string") return null;

  const source = normalizeSource(value.source);
  return {
    id: value.id,
    text: value.text,
    ...(typeof value.nodeId === "string" ? { nodeId: value.nodeId } : {}),
    ...(typeof value.speakerId === "string" || value.speakerId === null ? { speakerId: value.speakerId } : {}),
    ...(typeof value.command === "boolean" ? { command: value.command } : {}),
    ...(typeof value.artAssetId === "string" ? { artAssetId: value.artAssetId } : {}),
    ...(source ? { source } : {}),
  };
}

/**
 * Upgrade persisted presentation without throwing away compatible game progress.
 * v1 URL-only art lines are presentation residue and are intentionally omitted;
 * all semantic play state and text transcript lines are preserved.
 */
export function normalizePersistedPlaySession(value: unknown): PersistedPlaySession | undefined {
  if (!object(value) || (value.version !== 1 && value.version !== PLAY_SESSION_VERSION)) return undefined;
  if (typeof value.schemaVersion !== "number"
    || typeof value.projectRevision !== "number"
    || typeof value.savedAt !== "string"
    || !object(value.playState)
    || !object(value.presentation)) return undefined;

  const presentation = value.presentation;
  if (!Array.isArray(presentation.transcript)
    || typeof presentation.activeText !== "string"
    || !object(presentation.activePerformance)) return undefined;

  const activeSource = normalizeSource(presentation.activeSource);
  return {
    version: PLAY_SESSION_VERSION,
    schemaVersion: value.schemaVersion,
    projectRevision: value.projectRevision,
    savedAt: value.savedAt,
    playState: value.playState as PlayState,
    presentation: {
      transcript: presentation.transcript
        .map(normalizeTranscriptLine)
        .filter((line): line is PersistedTranscriptLine => Boolean(line)),
      activeText: presentation.activeText,
      ...(typeof presentation.activeNodeId === "string" ? { activeNodeId: presentation.activeNodeId } : {}),
      activeSpeakerId: typeof presentation.activeSpeakerId === "string" ? presentation.activeSpeakerId : null,
      activePerformance: presentation.activePerformance as TextPerformance,
      pendingDestinationNodeId: typeof presentation.pendingDestinationNodeId === "string"
        ? presentation.pendingDestinationNodeId
        : null,
      ...(activeSource ? { activeSource } : {}),
    },
    ...(value.resumeImmediately === true ? { resumeImmediately: true } : {}),
  };
}

export async function loadPlaySession() {
  try {
    const value = await withSessionStore("readonly", (store) => store.get(AUTOSAVE_KEY));
    const normalized = normalizePersistedPlaySession(value);
    return normalized ? structuredClone(normalized) : undefined;
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
