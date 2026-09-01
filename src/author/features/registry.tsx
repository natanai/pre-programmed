import { commandsAuthorFeature } from "../../features/commands/author/manifest";
import { mediaAuthorFeature } from "../../features/media/author/manifest";
import { narrativeAuthorFeature } from "../../features/narrative/author/manifest";
import { stateAuthorFeature } from "../../features/state/author/manifest";
import { ProjectSettingsWorkspace } from "../settings/ProjectSettingsWorkspace";
import { projectAuthorFeature } from "./projectManifest";
import type { AuthorFeatureManifest, AuthorWorkspaceContext } from "./types";
import type { AuthorPanelRoute } from "../workSurfaceNavigation";

export const AUTHOR_FEATURES: readonly AuthorFeatureManifest[] = [
  narrativeAuthorFeature,
  stateAuthorFeature,
  mediaAuthorFeature,
  commandsAuthorFeature,
  projectAuthorFeature,
];

export function resolveAuthorFeatureTerminalShortcut(command: string): AuthorPanelRoute | null {
  for (const feature of AUTHOR_FEATURES) {
    const shortcut = feature.terminalShortcuts?.find((candidate) => candidate.commands.includes(command));
    if (shortcut) return shortcut.route;
  }
  return null;
}

export function renderAuthorFeatureWorkspace(route: AuthorPanelRoute, context: AuthorWorkspaceContext) {
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
