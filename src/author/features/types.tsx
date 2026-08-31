import type { ReactNode } from "react";
import type { EffectEvent } from "../../game/effects";
import type {
  AuthorBookmark,
  MutationOperation,
  PlayState,
  ProjectSnapshot,
} from "../../game/model";
import type { AuthorToolContributor } from "../tools/types";
import type { AuthorPanelRoute } from "../workSurfaceNavigation";

export type AuthorPersist = (
  operations: MutationOperation[],
  description: string,
  closeAfterSave?: boolean,
) => Promise<void>;

export type AuthorWorkspaceContext = {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  authorMode: boolean;
  authorToken: string;
  persist: AuthorPersist;
  leaveCurrentSurface: () => void;
  pushPanel: (route: AuthorPanelRoute) => void;
  onWorkspaceDirtyChange: (dirty: boolean) => void;
  requestWorkspaceDiscard: (discard: () => void) => void;
  onInventoryState: (state: PlayState) => void;
  onInventoryOutput: (text: string) => void;
  onEvents: (events: EffectEvent[]) => void;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
};

export type AuthorFeatureManifest = {
  /** Stable feature identifier used only by the Author composition root. */
  id: string;
  /** Optional navigation contributions for the Author tool index. */
  tools?: AuthorToolContributor;
  /** Return a workspace for routes owned by this feature, otherwise null. */
  renderWorkspace?: (route: AuthorPanelRoute, context: AuthorWorkspaceContext) => ReactNode | null;
};
