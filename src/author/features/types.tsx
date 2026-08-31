import type { ReactNode } from "react";
import type { EffectEvent } from "../../game/effects";
import type {
  AuthorBookmark,
  MutationOperation,
  PlayState,
  ProjectSnapshot,
} from "../../game/model";
import type { AuthorPersistResult } from "../persistence/authorProjectPersistence";
import type { AuthorToolContributor } from "../tools/types";
import type { AuthorPanelRoute } from "../workSurfaceNavigation";

export type AuthorPersist = (
  operations: MutationOperation[],
  description: string,
  closeAfterSave?: boolean,
) => Promise<AuthorPersistResult>;

export type AuthorWorkspaceContext = {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  authorMode: boolean;
  authorToken: string;
  persist: AuthorPersist;
  leaveCurrentSurface: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
  pushPanel: (route: AuthorPanelRoute) => void;
  onInventoryState: (state: PlayState) => void;
  onInventoryOutput: (text: string) => void;
  onEvents: (events: EffectEvent[]) => void;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
};

export type AuthorProjectSettingsSection = {
  id: string;
  label: string;
  description: string;
  order?: number;
  render: (context: AuthorWorkspaceContext) => ReactNode;
};

export type AuthorFeatureManifest = {
  /** Stable feature identifier used only by the Author composition root. */
  id: string;
  /** Optional navigation contributions for the Author tool index. */
  tools?: AuthorToolContributor;
  /** Optional advanced project settings owned by this module. */
  projectSettings?: readonly AuthorProjectSettingsSection[];
  /** Return a workspace for routes owned by this feature, otherwise null. */
  renderWorkspace?: (route: AuthorPanelRoute, context: AuthorWorkspaceContext) => ReactNode | null;
};
