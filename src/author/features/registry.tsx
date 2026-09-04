import { Fragment } from "react";
import { commandsAuthorFeature } from "../../features/commands/author/manifest";
import { inventoryAuthorFeature } from "../../features/inventory/author/manifest";
import { mediaAuthorFeature } from "../../features/media/author/manifest";
import { narrativeAuthorFeature } from "../../features/narrative/author/manifest";
import { stateAuthorFeature } from "../../features/state/author/manifest";
import { worldAuthorFeature } from "../../features/world/author/manifest";
import type { AuthorResourceProvider } from "../resources/types";
import { ProjectSettingsWorkspace } from "../settings/ProjectSettingsWorkspace";
import type { AuthorTaskRoute } from "../tasks/types";
import { StructuredAuthorWorkspace } from "../ui/workspaceDefinition";
import { projectAuthorFeature } from "./projectManifest";
import type {
  AuthorFeatureManifest,
  AuthorPlaySurfaceContext,
  AuthorWorkspaceContext,
} from "./types";

/**
 * Existing prototype features that still contain unrestricted workspace markup.
 * New feature ids do not belong here: add data-first `workspaces` contributions
 * instead. Keeping the exception list centralized makes migration one-way and
 * makes any attempt to expand the legacy foundation obvious in review/tests.
 */
export const LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS = new Set([
  "narrative",
  "media",
  "commands",
  "project",
]);

/**
 * Single composition registry for Author-capable feature modules.
 *
 * New workspaces should contribute semantic workspace definitions. Legacy
 * renderers remain temporarily available only to the explicit migration set.
 */
export const AUTHOR_FEATURES: readonly AuthorFeatureManifest[] = [
  narrativeAuthorFeature,
  worldAuthorFeature,
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

export function getAuthorCommandReferenceSources() {
  return AUTHOR_FEATURES.flatMap((feature) => feature.commandReferences ?? []);
}

export function getAuthorCommandTargetAdapter(sourceKind: string) {
  return AUTHOR_FEATURES
    .flatMap((feature) => feature.commandTargets ?? [])
    .find((adapter) => adapter.sourceKind === sourceKind);
}

export function getAuthorOperationDefinitions() {
  return AUTHOR_FEATURES.flatMap((feature) => feature.operations ?? []);
}

export function getAuthorConditionAdapters() {
  return AUTHOR_FEATURES.flatMap((feature) => feature.conditions ?? []);
}

export function getAuthorEffectAdapters() {
  return AUTHOR_FEATURES.flatMap((feature) => feature.effects ?? []);
}

export function getAuthorTextCueAdapters() {
  return AUTHOR_FEATURES.flatMap((feature) => feature.textCues ?? []);
}

export function getAuthorSearchDocumentContributions() {
  return AUTHOR_FEATURES.flatMap((feature) => feature.searchDocuments ?? []);
}

export function getAuthorReferenceContributions() {
  return AUTHOR_FEATURES.flatMap((feature) => feature.references ?? []);
}

export function resolveAuthorFeatureTerminalShortcut(command: string): AuthorTaskRoute | null {
  for (const feature of AUTHOR_FEATURES) {
    const shortcut = feature.terminalShortcuts?.find((candidate) => candidate.commands.includes(command));
    if (shortcut) return shortcut.route;
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
    if (route.type === "feature") {
      const definition = feature.workspaces?.find((candidate) => candidate.matches(route));
      if (definition) return <StructuredAuthorWorkspace definition={definition} route={route} context={context} />;
    }

    if (feature.renderWorkspace) {
      if (!LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS.has(feature.id)) {
        throw new Error(`Feature ${feature.id} attempted to use legacy Author workspace rendering.`);
      }
      const workspace = feature.renderWorkspace(route, context);
      if (workspace !== null && workspace !== undefined) return workspace;
    }
  }
  return null;
}

/**
 * Describe a task without teaching the shell any feature-specific routes.
 * Feature manifests own their vocabulary; the shell only composes the trail.
 */
export function describeAuthorTask(route: AuthorTaskRoute, snapshot: AuthorWorkspaceContext["snapshot"]): string {
  if (route.type === "tools") return "Author tools";
  if (route.type === "workspace") return route.view === "history" ? "History" : "Locations";
  for (const feature of AUTHOR_FEATURES) {
    const label = feature.describeTask?.(route, snapshot);
    if (label) return label;
  }
  return route.type === "feature"
    ? `${route.feature} · ${route.workspace}`.replaceAll("-", " ")
    : "Author task";
}
