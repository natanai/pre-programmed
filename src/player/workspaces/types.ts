import type { ReactNode } from "react";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";

/** A player-owned modal/workspace request. This is intentionally not an Author task route. */
export type PlayerWorkspaceRequest = {
  feature: string;
  workspace: string;
  data?: Record<string, string>;
};

export type PlayerWorkspaceContext = {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  updateState: (state: PlayState) => void;
  output: (text: string) => void;
  events: (events: EffectEvent[]) => void;
};

export type PlayerWorkspaceNavigationEntry = {
  id: string;
  label: string;
  request: PlayerWorkspaceRequest;
};

/**
 * Feature-owned player workspace contribution.
 *
 * The shared player host owns modal navigation/close presentation. Features own
 * the actual player interaction surface and may contribute current-state-aware
 * destinations to the shared player navigation bar. No Author task/persistence
 * API is available here by design.
 */
export type PlayerWorkspaceContribution = {
  feature: string;
  workspace: string;
  label: string;
  navigation?: (context: PlayerWorkspaceContext) => readonly PlayerWorkspaceNavigationEntry[];
  render: (request: PlayerWorkspaceRequest, context: PlayerWorkspaceContext) => ReactNode;
};
