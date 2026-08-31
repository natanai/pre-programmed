import { createPortal } from "react-dom";
import { AuthorToolIndex, type AuthorToolGroup } from "../AuthorToolIndex";
import { renderAuthorFeatureWorkspace } from "../features/registry";
import type { AuthorWorkspaceContext } from "../features/types";
import type { AuthorLeaveConfirmation, AuthorPanelRoute } from "../workSurfaceNavigation";

/**
 * Composition host for focused Author workspaces.
 *
 * App supplies the live session/navigation context. Feature-specific rendering
 * is delegated to the Author feature manifest registry. The rendered workspace
 * is portaled to a root Author layer so player-terminal geometry can never
 * constrain an editor's viewport or keyboard behavior.
 *
 * The root owns guarded Back navigation and the single discard-confirmation
 * surface shared by Back and the application-level X escape.
 */
export function AuthorWorkspaceHost({
  panel,
  toolGroups,
  leaveConfirmation,
  onConfirmLeave,
  onCancelLeave,
  ...context
}: AuthorWorkspaceContext & {
  panel: AuthorPanelRoute | null;
  toolGroups: AuthorToolGroup[];
  leaveConfirmation: AuthorLeaveConfirmation | null;
  onConfirmLeave: () => void;
  onCancelLeave: () => void;
}) {
  if (!panel) return null;
  const workspace = panel.type === "tools"
    ? <AuthorToolIndex groups={toolGroups} />
    : renderAuthorFeatureWorkspace(panel, context);
  if (!workspace) return null;

  return createPortal(
    <div
      className="author-workspace-layer"
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <nav className="author-workspace-navigation" aria-label="Author workspace navigation">
        <button
          type="button"
          className="author-workspace-back"
          onClick={context.leaveCurrentSurface}
        >
          [← BACK]
        </button>
      </nav>
      <div className="author-workspace-content">
        {workspace}
      </div>
      {leaveConfirmation ? <div className="author-leave-shade">
        <section
          className="author-leave-confirmation"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="author-leave-title"
          aria-describedby="author-leave-copy"
        >
          <h2 id="author-leave-title">UNSAVED CHANGES</h2>
          <p id="author-leave-copy">
            {leaveConfirmation.action === "close" && leaveConfirmation.dirtyCount > 1
              ? `${leaveConfirmation.dirtyCount} Author workspaces contain unsaved changes.`
              : "This Author workspace contains unsaved changes."}
          </p>
          <div className="author-leave-actions">
            <button type="button" autoFocus onClick={onCancelLeave}>[KEEP EDITING]</button>
            <button type="button" onClick={onConfirmLeave}>[DISCARD CHANGES]</button>
          </div>
        </section>
      </div> : null}
    </div>,
    document.body,
  );
}
