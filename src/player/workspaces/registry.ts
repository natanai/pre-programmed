import { inventoryPlayerWorkspaceContribution } from "../../features/inventory/playerWorkspace";
import { stateStatusPlayerWorkspaceContribution } from "../../features/state/playerWorkspace";
import type { PlayerWorkspaceContribution, PlayerWorkspaceRequest } from "./types";

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
