import { Fragment } from "react";
import { commandsAuthorFeature } from "../../features/commands/author/manifest";
import { inventoryAuthorFeature } from "../../features/inventory/author/manifest";
import { mediaAuthorFeature } from "../../features/media/author/manifest";
import { narrativeAuthorFeature } from "../../features/narrative/author/manifest";
import { radixAuthorFeature } from "../../features/radix/author/manifest";
import { stateAuthorFeature } from "../../features/state/author/manifest";
import { worldAuthorFeature } from "../../features/world/author/manifest";
import type { AuthorResourceProvider } from "../resources/types";
import { createProjectSettingsWorkspace } from "../settings/ProjectSettingsWorkspace";
import type { AuthorTaskRoute } from "../tasks/types";
import { StructuredAuthorWorkspace } from "../ui/workspaceDefinition";
import { WorkspacePanel } from "../workspace/WorkspacePanel";
import { projectAuthorFeature } from "./projectManifest";
import type {
  AuthorFeatureManifest,
  AuthorPlaySurfaceContext,
  AuthorWorkspaceContext,
} from "./types";

/** Single composition registry for Author-capable feature modules. */
export const AUTHOR_FEATURES: readonly AuthorFeatureManifest[] = [
  narrativeAuthorFeature,
  worldAuthorFeature,
  stateAuthorFeature,
  inventoryAuthorFeature,
  mediaAuthorFeature,
  radixAuthorFeature,
  commandsAuthorFeature,
  projectAuthorFeature,
];

const PROJECT_SETTINGS_WORKSPACE = createProjectSettingsWorkspace(
  AUTHOR_FEATURES.flatMap((feature) => feature.projectSettings ?? []),
);

export function getAuthorResourceProvider(kind: string): AuthorResourceProvider | undefined {
  for (const feature of AUTHOR_FEATURES) {
    const provider = feature.resources?.find((candidate) => candidate.kind === kind);
    if (provider) return provider;
  }
  return undefined;
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
  if (route.type === "workspace") {
    return <WorkspacePanel
      token={context.authorToken}
      snapshot={context.snapshot}
      playState={context.playState}
      initialView={route.view === "history" ? "history" : "navigation"}
      onSnapshot={context.onSnapshot}
      onRestore={context.onRestore}
      onEditNode={(nodeId) => context.resources.edit("node", nodeId)}
    />;
  }

  if (route.type === "feature" && route.feature === "project" && route.workspace === "settings") {
    return <StructuredAuthorWorkspace definition={PROJECT_SETTINGS_WORKSPACE} route={route} context={context} />;
  }

  for (const feature of AUTHOR_FEATURES) {
    if (route.type !== "feature") continue;
    const definition = feature.workspaces?.find((candidate) => candidate.matches(route));
    if (definition) return <StructuredAuthorWorkspace definition={definition} route={route} context={context} />;
  }
  return null;
}

/** Describe a task without teaching the shell feature-specific resource routes. */
export function describeAuthorTask(route: AuthorTaskRoute, snapshot: AuthorWorkspaceContext["snapshot"]): string {
  if (route.type === "tools") return "Author tools";
  if (route.type === "workspace") return route.view === "history" ? "History" : "Run navigation";
  for (const feature of AUTHOR_FEATURES) {
    const label = feature.describeTask?.(route, snapshot);
    if (label) return label;
  }
  return route.type === "feature"
    ? `${route.feature} · ${route.workspace}`.replaceAll("-", " ")
    : "Author task";
}
