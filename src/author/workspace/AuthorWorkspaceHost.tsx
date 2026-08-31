import { createPortal } from "react-dom";
import { AuthorToolIndex, type AuthorToolGroup } from "../AuthorToolIndex";
import { renderAuthorFeatureWorkspace } from "../features/registry";
import type { AuthorWorkspaceContext } from "../features/types";
import type { AuthorPanelRoute } from "../workSurfaceNavigation";

/**
 * Composition host for focused Author workspaces.
 *
 * App supplies the live session/navigation context. Feature-specific rendering
 * is delegated to the Author feature manifest registry. The rendered workspace
 * is portaled to a root Author layer so player-terminal geometry can never
 * constrain an editor's viewport or keyboard behavior.
 */
export function AuthorWorkspaceHost({
  panel,
  toolGroups,
  ...context
}: AuthorWorkspaceContext & {
  panel: AuthorPanelRoute | null;
  toolGroups: AuthorToolGroup[];
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
      {workspace}
    </div>,
    document.body,
  );
}
