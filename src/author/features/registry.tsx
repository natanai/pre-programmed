import { commandsAuthorFeature } from "../../features/commands/author/manifest";
import { inventoryAuthorFeature } from "../../features/inventory/author/manifest";
import { narrativeAuthorFeature } from "../../features/narrative/author/manifest";
import { stateAuthorFeature } from "../../features/state/author/manifest";
import { ProjectSettingsWorkspace } from "../settings/ProjectSettingsWorkspace";
import { projectAuthorFeature } from "./projectManifest";
import type { AuthorFeatureManifest, AuthorWorkspaceContext } from "./types";
import type { AuthorPanelRoute } from "../workSurfaceNavigation";

/**
 * Single composition registry for Author-capable feature modules.
 *
 * A new feature should own its tools/workspace renderer/settings sections beside
 * the feature and add one manifest here. App does not need to know which Author
 * modules exist.
 */
export const AUTHOR_FEATURES: readonly AuthorFeatureManifest[] = [
  narrativeAuthorFeature,
  stateAuthorFeature,
  inventoryAuthorFeature,
  commandsAuthorFeature,
  projectAuthorFeature,
];

export function renderAuthorFeatureWorkspace(
  route: AuthorPanelRoute,
  context: AuthorWorkspaceContext,
) {
  if (route.type === "feature" && route.feature === "project" && route.workspace === "settings") {
    const sections = AUTHOR_FEATURES.flatMap((feature) => feature.projectSettings ?? []);
    return <ProjectSettingsWorkspace route={route} sections={sections} context={context} />;
  }

  for (const feature of AUTHOR_FEATURES) {
    const workspace = feature.renderWorkspace?.(route, context);
    if (workspace !== null && workspace !== undefined) return workspace;
  }
  return null;
}
