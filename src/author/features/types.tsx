import type { ReactNode } from "react";
import type { AuthorCapability } from "../capabilities/types";
import type { EffectEvent } from "../../game/effects";
import type {
  AuthorBookmark,
  MutationOperation,
  PlayState,
  ProjectSnapshot,
  TextPerformance,
} from "../../game/model";
import type { AuthorPersistResult } from "../persistence/authorProjectPersistence";
import type { AuthorResourceProvider, AuthorResourceTools } from "../resources/types";
import type { AuthorSearchContributor } from "../search/types";
import type { AuthorTaskCompletion, AuthorTaskResult, AuthorTaskRoute } from "../tasks/types";
import type { AuthorToolContributor } from "../tools/types";

export type AuthorPersist = (
  operations: MutationOperation[],
  description: string,
) => Promise<AuthorPersistResult>;

/** Runtime presentation capabilities available to any feature workspace. */
export type AuthorRuntimeSurface = {
  updateState: (state: PlayState) => void;
  output: (text: string) => void;
  events: (events: EffectEvent[]) => void;
  /** Present authored text/effects without mutating play state. */
  preview: (presentation: {
    text: string;
    performance: TextPerformance;
    speakerId?: string | null;
    events?: EffectEvent[];
  }) => void;
  /** Close Author work and run an authored player phrase through the real runtime. */
  tryInput: (input: string) => void;
};

export type AuthorWorkspaceContext = {
  taskId: string;
  snapshot: ProjectSnapshot;
  playState: PlayState;
  authorMode: boolean;
  authorToken: string;
  persist: AuthorPersist;
  completeTask: (result?: AuthorTaskResult) => void;
  leaveCurrentTask: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
  pushTask: (route: AuthorTaskRoute, onComplete?: AuthorTaskCompletion) => string;
  resources: AuthorResourceTools;
  runtime: AuthorRuntimeSurface;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
};

/** Context for feature-owned controls shown directly beside live play in Author mode. */
export type AuthorPlaySurfaceContext = {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  pushTask: (route: AuthorTaskRoute, onComplete?: AuthorTaskCompletion) => string;
  submitInput: (input: string) => void;
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
  route: AuthorTaskRoute;
};

export type AuthorFeatureManifest = {
  /** Stable feature identifier used only by the Author composition root. */
  id: string;
  /** Optional navigation contributions for the Author tool index. */
  tools?: AuthorToolContributor;
  /** Nested destinations and vocabulary exposed to Author-wide search. */
  search?: AuthorSearchContributor;
  /** Resources this feature owns and can create/edit from reference fields. */
  resources?: readonly AuthorResourceProvider[];
  /** Optional advanced project settings owned by this module. */
  projectSettings?: readonly AuthorProjectSettingsSection[];
  /** Optional terminal aliases that open a workspace owned by this feature. */
  terminalShortcuts?: readonly AuthorTerminalShortcut[];
  /** Semantic requests this feature can fulfill without direct feature imports. */
  capabilities?: readonly AuthorCapability[];
  /** Optional contextual Author controls rendered beside the live play surface. */
  renderPlaySurface?: (context: AuthorPlaySurfaceContext) => ReactNode | null;
  /** Return a workspace for routes owned by this feature, otherwise null. */
  renderWorkspace?: (route: AuthorTaskRoute, context: AuthorWorkspaceContext) => ReactNode | null;
};
