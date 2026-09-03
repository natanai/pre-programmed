import { createPortal } from "react-dom";
import { resolvePlayerWorkspace } from "./registry";
import type { PlayerWorkspaceContext, PlayerWorkspaceRequest } from "./types";
import "./playerWorkspace.css";

export function PlayerWorkspaceHost({
  request,
  context,
  onClose,
}: {
  request: PlayerWorkspaceRequest | null;
  context: PlayerWorkspaceContext;
  onClose: () => void;
}) {
  if (!request) return null;
  const contribution = resolvePlayerWorkspace(request);

  return createPortal(
    <section className="player-workspace-layer" aria-label={contribution?.label ?? "Player workspace"}>
      <header className="player-workspace-header">
        <strong>{contribution?.label ?? "Unavailable"}</strong>
        <button type="button" aria-label="Close and return to game" onClick={onClose}>[X]</button>
      </header>
      <div className="player-workspace-content">
        {contribution
          ? contribution.render(request, context)
          : <p className="player-workspace-error">THIS PLAYER WORKSPACE IS NOT INSTALLED.</p>}
      </div>
    </section>,
    document.body,
  );
}
