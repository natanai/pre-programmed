import { inventoryAuthorFeature } from "../../features/inventory/author/manifest";
import { mediaAuthorFeature } from "../../features/media/author/manifest";
import { narrativeAuthorFeature } from "../../features/narrative/author/manifest";
import { stateAuthorFeature } from "../../features/state/author/manifest";
import { projectAuthorFeature } from "./projectManifest";
import type { AuthorFeatureManifest, AuthorWorkspaceContext } from "./types";
import type { AuthorPanelRoute } from "../workSurfaceNavigation";

/**
 * Single composition registry for Author-capable feature modules.
 *
 * A new feature should own its tools/workspace renderer beside the feature and
 * add one manifest here. App does not need to know which Author modules exist.
 */
export const AUTHOR_FEATURES: readonly AuthorFeatureManifest[] = [
  narrativeAuthorFeature,
  stateAuthorFeature,
  inventoryAuthorFeature,
  mediaAuthorFeature,
  projectAuthorFeature,
];

export function renderAuthorFeatureWorkspace(
  route: AuthorPanelRoute,
  context: AuthorWorkspaceContext,
) {
  for (const feature of AUTHOR_FEATURES) {
    const workspace = feature.renderWorkspace?.(route, context);
    if (workspace !== null && workspace !== undefined) return workspace;
  }
  return null;
}
