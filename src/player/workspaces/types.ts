import type { ReactNode } from "react";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";

/** A player-owned modal/workspace request. This is intentionally not an Author task route. */
export type PlayerWorkspaceRequest = {
  feature: string;
  workspace: string;
  data?: Record<string, string>;
};

/**
 * Optional bridge present only while the authenticated Author experience is on.
 * Player workspaces stay player-owned; this bridge merely lets the feature open
 * one of its real Author tasks from the live thing the author is looking at.
 */
export type PlayerWorkspaceAuthorBridge = {
  /** Open a feature-owned Author task when the player surface itself owns the contextual destination. */
  openWorkspace: (feature: string, workspace: string, data?: Record<string, string>) => void;
  /** Edit a durable resource through its canonical provider rather than hard-coding another feature's route. */
  editResource: (kind: string, id: string, focus?: Record<string, string>) => void;
};

export type PlayerWorkspaceContext = {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  updateState: (state: PlayState) => void;
  output: (text: string) => void;
  events: (events: EffectEvent[]) => void;
  author?: PlayerWorkspaceAuthorBridge;
};

export type PlayerWorkspaceNavigationEntry = {
  id: string;
  label: string;
  request: PlayerWorkspaceRequest;
};

export type PlayerWorkspaceAuthorAction = {
  id: string;
  label: string;
  onAction: () => void;
};

/**
 * Feature-owned player workspace contribution.
 *
 * The shared player host owns modal navigation/close/Author-action presentation.
 * Features own the actual live interaction surface and may contribute
 * current-state-aware destinations plus contextual editing actions. Author
 * actions are impossible unless the shell supplied the optional Author bridge.
 */
export type PlayerWorkspaceContribution = {
  feature: string;
  workspace: string;
  label: string;
  navigation?: (context: PlayerWorkspaceContext) => readonly PlayerWorkspaceNavigationEntry[];
  authorActions?: (request: PlayerWorkspaceRequest, context: PlayerWorkspaceContext) => readonly PlayerWorkspaceAuthorAction[];
  render: (request: PlayerWorkspaceRequest, context: PlayerWorkspaceContext) => ReactNode;
};
