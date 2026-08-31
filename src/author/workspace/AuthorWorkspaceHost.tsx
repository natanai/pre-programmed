import { AuthorToolIndex, type AuthorToolGroup } from "../AuthorToolIndex";
import { renderAuthorFeatureWorkspace } from "../features/registry";
import type { AuthorWorkspaceContext } from "../features/types";
import { useWorkSurfaceGuard, type AuthorPanelRoute } from "../workSurfaceNavigation";

/**
 * Composition host for focused Author workspaces.
 *
 * App supplies the live session/navigation context. Feature-specific rendering
 * is delegated to the Author feature manifest registry, leaving this host to
 * own only cross-feature Author surfaces such as the tool index and navigation
 * safety affordances.
 */
export function AuthorWorkspaceHost({
  panel,
  toolGroups,
  ...context
}: Omit<AuthorWorkspaceContext, "onWorkspaceDirtyChange" | "requestWorkspaceDiscard"> & {
  panel: AuthorPanelRoute | null;
  toolGroups: AuthorToolGroup[];
}) {
  const guard = useWorkSurfaceGuard();
  const workspaceContext: AuthorWorkspaceContext = {
    ...context,
    onWorkspaceDirtyChange: guard.setDirty,
    requestWorkspaceDiscard: guard.requestDiscard,
  };

  const workspace = panel?.type === "tools"
    ? <AuthorToolIndex groups={toolGroups} />
    : panel
      ? renderAuthorFeatureWorkspace(panel, workspaceContext)
      : null;

  return <>
    {workspace}
    {guard.pending ? <section className="author-unsaved-prompt" role="alertdialog" aria-modal="true" aria-labelledby="author-unsaved-title" onPointerDown={(event) => event.stopPropagation()}>
      <div className="author-unsaved-card">
        <strong id="author-unsaved-title">UNSAVED CHANGES</strong>
        <span>Discard these edits and leave this workspace?</span>
        <div>
          <button type="button" autoFocus onClick={guard.cancelDiscard}>[KEEP EDITING]</button>
          <button type="button" className="author-discard-action" onClick={guard.confirmDiscard}>[DISCARD]</button>
        </div>
      </div>
    </section> : null}
  </>;
}
