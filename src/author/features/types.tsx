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

/** Runtime presentation capabilities available to any feature workspace. */
export type AuthorRuntimeSurface = {
  updateState: (state: PlayState) => void;
  output: (text: string) => void;
  events: (events: EffectEvent[]) => void;
};

export type AuthorWorkspaceContext = {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  authorMode: boolean;
  authorToken: string;
  persist: AuthorPersist;
  leaveCurrentSurface: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
  pushPanel: (route: AuthorPanelRoute) => void;
  runtime: AuthorRuntimeSurface;
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

export type AuthorTerminalShortcut = {
  commands: readonly string[];
  route: AuthorPanelRoute;
};

export type AuthorUnhandledInputMutation = {
  operations: MutationOperation[];
  description: string;
};

export type AuthorFeatureManifest = {
  /** Stable feature identifier used only by the Author composition root. */
  id: string;
  /** Optional navigation contributions for the Author tool index. */
  tools?: AuthorToolContributor;
  /** Optional advanced project settings owned by this module. */
  projectSettings?: readonly AuthorProjectSettingsSection[];
  /** Optional terminal aliases that open a workspace owned by this feature. */
  terminalShortcuts?: readonly AuthorTerminalShortcut[];
  /** Optional owner for converting an unmatched player input into an Author mutation. */
  buildUnhandledInputMutation?: (sourceNodeId: string, input: string) => AuthorUnhandledInputMutation | null;
  /** Return a workspace for routes owned by this feature, otherwise null. */
  renderWorkspace?: (route: AuthorPanelRoute, context: AuthorWorkspaceContext) => ReactNode | null;
};
