import { AuthorToolIndex, type AuthorToolGroup } from "../AuthorToolIndex";
import { renderAuthorFeatureWorkspace } from "../features/registry";
import type { AuthorWorkspaceContext } from "../features/types";
import type { AuthorPanelRoute } from "../workSurfaceNavigation";

/**
 * Composition host for focused Author workspaces.
 *
 * App supplies the live session/navigation context. Feature-specific rendering
 * is delegated to the Author feature manifest registry, leaving this host to
 * own only cross-feature Author surfaces such as the tool index.
 */
export function AuthorWorkspaceHost({
  panel,
  toolGroups,
  ...context
}: AuthorWorkspaceContext & {
  panel: AuthorPanelRoute | null;
  toolGroups: AuthorToolGroup[];
}) {
  if (panel?.type === "tools") return <AuthorToolIndex groups={toolGroups} />;
  if (!panel) return null;
  return renderAuthorFeatureWorkspace(panel, context);
}
