import {
  isPlaySessionCompatible,
  loadPlaySession,
  normalizePersistedPlaySession,
  PLAY_SESSION_VERSION,
  type PersistedPlayPresentation,
  type PersistedPlaySession,
} from "../../../data/localPlaySession";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import { resolveNodeOpeningPresentation } from "../../narrative/runtime/presentation";

const PORTABLE_SAVE_FORMAT = "pre-programmed-player-save" as const;
const PORTABLE_SAVE_VERSION = 1 as const;
const DEFAULT_TEXT_PERFORMANCE = { charactersPerSecond: 18, cues: [] };

export type PortablePlaySave = {
  format: typeof PORTABLE_SAVE_FORMAT;
  version: typeof PORTABLE_SAVE_VERSION;
  exportedAt: string;
  session: PersistedPlaySession;
};

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function currentPresentation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  previous?: PersistedPlaySession,
): PersistedPlayPresentation {
  const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
  if (!node) {
    return {
      transcript: previous?.presentation.transcript ?? [],
      activeText: "",
      activeSpeakerId: null,
      activePerformance: DEFAULT_TEXT_PERFORMANCE,
      pendingDestinationNodeId: null,
    };
  }

  const presentation = resolveNodeOpeningPresentation(snapshot, state, node);
  return {
    transcript: previous?.presentation.transcript ?? [],
    activeText: presentation.text,
    activeNodeId: node.id,
    activeSpeakerId: presentation.speakerId,
    activePerformance: presentation.performance,
    pendingDestinationNodeId: null,
    activeSource: presentation.source,
  };
}

/**
 * Capture the semantic run state plus the current terminal presentation.
 *
 * The normal browser autosave remains the primary live presentation source. A
 * short yield lets the existing autosave effect catch the `save` command before
 * export; if browser persistence is unavailable, the current Node presentation
 * is rebuilt through the same canonical Narrative presentation resolver used by
 * live play instead of duplicating Node-opening selection here.
 */
export async function buildPortablePlaySession(
  snapshot: ProjectSnapshot,
  state: PlayState,
): Promise<PersistedPlaySession> {
  await delay(300);
  const previous = await loadPlaySession();
  const compatiblePrevious = previous && isPlaySessionCompatible(snapshot, previous)
    ? previous
    : undefined;
  const sameNode = compatiblePrevious?.playState.currentNodeId === state.currentNodeId;
  const presentation = sameNode
    ? structuredClone(compatiblePrevious.presentation)
    : currentPresentation(snapshot, state, compatiblePrevious);

  return {
    version: PLAY_SESSION_VERSION,
    schemaVersion: snapshot.schemaVersion,
    projectRevision: snapshot.revision,
    savedAt: new Date().toISOString(),
    playState: structuredClone(state),
    presentation,
  };
}

export function portablePlaySave(session: PersistedPlaySession): PortablePlaySave {
  return {
    format: PORTABLE_SAVE_FORMAT,
    version: PORTABLE_SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    session: structuredClone(session),
  };
}

export function downloadPortablePlaySave(session: PersistedPlaySession) {
  const payload = JSON.stringify(portablePlaySave(session), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const timestamp = new Date(session.savedAt).toISOString().replace(/[:.]/g, "-");
  const filename = `pre-programmed-save-${timestamp}.ppsave`;
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return filename;
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function parsePortablePlaySave(
  snapshot: ProjectSnapshot,
  text: string,
): PersistedPlaySession {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  if (!object(value)
    || value.format !== PORTABLE_SAVE_FORMAT
    || value.version !== PORTABLE_SAVE_VERSION) {
    throw new Error("That is not a Pre-Programmed player save file.");
  }

  const session = normalizePersistedPlaySession(value.session);
  if (!session) throw new Error("The save file is damaged or uses an unsupported save format.");
  if (!isPlaySessionCompatible(snapshot, session)) {
    throw new Error("This save file is not compatible with the current game data.");
  }
  return session;
}
