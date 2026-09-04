import { useEffect } from "react";
import type { PersistedPlaySession } from "../data/localPlaySession";
import "./playerSessionGate.css";

const immediatelyResumedSessions = new WeakSet<PersistedPlaySession>();

export function PlayerSessionGate({ session, onContinue, onNewGame }: {
  session: PersistedPlaySession;
  onContinue: () => void;
  onNewGame: () => void;
}) {
  useEffect(() => {
    if (!session.resumeImmediately || immediatelyResumedSessions.has(session)) return;
    immediatelyResumedSessions.add(session);
    onContinue();
  }, [onContinue, session]);

  if (session.resumeImmediately) return null;

  const savedAt = new Date(session.savedAt);
  const savedLabel = Number.isNaN(savedAt.valueOf()) ? "a previous session" : savedAt.toLocaleString();
  return <div className="player-session-shade" role="presentation">
    <section className="player-session-gate" role="dialog" aria-modal="true" aria-labelledby="player-session-title">
      <h1 id="player-session-title">SAVED GAME FOUND</h1>
      <p>Your last play session was saved in this browser at {savedLabel}.</p>
      {session.projectRevision !== 0 ? <p className="player-session-revision">Saved from project revision R{session.projectRevision}. Compatible newer revisions are reconciled when you continue.</p> : null}
      <div className="player-session-actions">
        <button type="button" autoFocus onClick={onContinue}>[CONTINUE]</button>
        <button type="button" onClick={onNewGame}>[NEW GAME]</button>
      </div>
      <small>New Game replaces this browser’s autosave when play begins again.</small>
    </section>
  </div>;
}
