import { Fragment } from "react";
import { commandsAuthorFeature } from "../../features/commands/author/manifest";
import { inventoryAuthorFeature } from "../../features/inventory/author/manifest";
import { mediaAuthorFeature } from "../../features/media/author/manifest";
import { narrativeAuthorFeature } from "../../features/narrative/author/manifest";
import { stateAuthorFeature } from "../../features/state/author/manifest";
import type { AuthorResourceProvider } from "../resources/types";
import { ProjectSettingsWorkspace } from "../settings/ProjectSettingsWorkspace";
import type { AuthorTaskRoute } from "../tasks/types";
import { projectAuthorFeature } from "./projectManifest";
import type {
  AuthorFeatureManifest,
  AuthorPlaySurfaceContext,
  AuthorUnhandledInputMutation,
  AuthorWorkspaceContext,
} from "./types";

/**
 * Single composition registry for Author-capable feature modules.
 *
 * A new feature should own its tools/workspace renderer/resources/settings/
 * terminal aliases beside the feature and add one manifest here. App does not
 * need to know which Author modules or resource kinds exist.
 */
export const AUTHOR_FEATURES: readonly AuthorFeatureManifest[] = [
  narrativeAuthorFeature,
  stateAuthorFeature,
  inventoryAuthorFeature,
  mediaAuthorFeature,
  commandsAuthorFeature,
  projectAuthorFeature,
];

export function getAuthorResourceProvider(kind: string): AuthorResourceProvider | undefined {
  for (const feature of AUTHOR_FEATURES) {
    const provider = feature.resources?.find((candidate) => candidate.kind === kind);
    if (provider) return provider;
  }
  return undefined;
}

export function resolveAuthorFeatureTerminalShortcut(command: string): AuthorTaskRoute | null {
  for (const feature of AUTHOR_FEATURES) {
    const shortcut = feature.terminalShortcuts?.find((candidate) => candidate.commands.includes(command));
    if (shortcut) return shortcut.route;
  }
  return null;
}

export function resolveAuthorUnhandledInputMutation(
  sourceNodeId: string,
  input: string,
): AuthorUnhandledInputMutation | null {
  for (const feature of AUTHOR_FEATURES) {
    const mutation = feature.buildUnhandledInputMutation?.(sourceNodeId, input);
    if (mutation) return mutation;
  }
  return null;
}

export function renderAuthorFeaturePlaySurfaces(context: AuthorPlaySurfaceContext) {
  return <>{AUTHOR_FEATURES.map((feature) => {
    const surface = feature.renderPlaySurface?.(context);
    return surface === null || surface === undefined
      ? null
      : <Fragment key={feature.id}>{surface}</Fragment>;
  })}</>;
}

export function renderAuthorFeatureWorkspace(
  route: AuthorTaskRoute,
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
