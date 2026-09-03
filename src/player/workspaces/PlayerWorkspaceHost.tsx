import { createPortal } from "react-dom";
import { buildPlayerWorkspaceNavigation, resolvePlayerWorkspace } from "./registry";
import type { PlayerWorkspaceContext, PlayerWorkspaceRequest } from "./types";
import "./playerWorkspace.css";

function sameWorkspace(left: PlayerWorkspaceRequest, right: PlayerWorkspaceRequest) {
  if (left.feature !== right.feature || left.workspace !== right.workspace) return false;
  return (left.data?.groupId ?? "") === (right.data?.groupId ?? "");
}

export function PlayerWorkspaceHost({
  request,
  context,
  onNavigate,
  onClose,
}: {
  request: PlayerWorkspaceRequest | null;
  context: PlayerWorkspaceContext;
  onNavigate: (request: PlayerWorkspaceRequest) => void;
  onClose: () => void;
}) {
  if (!request) return null;
  const contribution = resolvePlayerWorkspace(request);
  const navigation = buildPlayerWorkspaceNavigation(context);
  const activeNavigation = navigation.find((entry) => sameWorkspace(entry.request, request));
  const title = activeNavigation?.label ?? contribution?.label ?? "Unavailable";

  return createPortal(
    <section className="player-workspace-layer" aria-label={title}>
      <header className="player-workspace-header">
        <strong>{title}</strong>
        <button type="button" aria-label="Close and return to game" onClick={onClose}>[X]</button>
      </header>
      {navigation.length ? <nav className="player-workspace-navigation" aria-label="Player information">
        {navigation.map((entry) => <button
          type="button"
          key={entry.id}
          aria-pressed={sameWorkspace(entry.request, request)}
          onClick={() => onNavigate(entry.request)}
        >[{entry.label.toUpperCase()}]</button>)}
      </nav> : null}
      <div className="player-workspace-content">
        {contribution
          ? contribution.render(request, context)
          : <p className="player-workspace-error">THIS PLAYER WORKSPACE IS NOT INSTALLED.</p>}
      </div>
    </section>,
    document.body,
  );
}
