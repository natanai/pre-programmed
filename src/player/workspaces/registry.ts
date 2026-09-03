import { inventoryPlayerWorkspaceContribution } from "../../features/inventory/playerWorkspace";
import { stateStatusPlayerWorkspaceContribution } from "../../features/state/playerWorkspace";
import type {
  PlayerWorkspaceContext,
  PlayerWorkspaceContribution,
  PlayerWorkspaceNavigationEntry,
  PlayerWorkspaceRequest,
} from "./types";

/** Explicit composition root for player-owned modal workspaces. */
export const PLAYER_WORKSPACES: readonly PlayerWorkspaceContribution[] = [
  inventoryPlayerWorkspaceContribution,
  stateStatusPlayerWorkspaceContribution,
];

export function resolvePlayerWorkspace(request: PlayerWorkspaceRequest): PlayerWorkspaceContribution | undefined {
  return PLAYER_WORKSPACES.find((contribution) =>
    contribution.feature === request.feature && contribution.workspace === request.workspace,
  );
}

export function buildPlayerWorkspaceNavigation(context: PlayerWorkspaceContext): PlayerWorkspaceNavigationEntry[] {
  const entries = PLAYER_WORKSPACES.flatMap((contribution) => contribution.navigation?.(context) ?? []);
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}
