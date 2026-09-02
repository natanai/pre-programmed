import type { ReactNode } from "react";
import type { AuthorCapability } from "../capabilities/types";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import type {
  AuthorBookmark,
  MutationOperation,
  PlayState,
  ProjectSnapshot,
} from "../../engine/project/model";
import type { TextPerformance } from "../../features/narrative/model";
import type { AuthorPersistResult } from "../persistence/authorProjectPersistence";
import type { AuthorResourceProvider, AuthorResourceTools } from "../resources/types";
import type { ProjectReferenceContribution } from "../references/types";
import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../rules/types";
import type { AuthorSearchContributor } from "../search/types";
import type { SearchDocumentContribution } from "../search/types";
import type { AuthorTaskCompletion, AuthorTaskResult, AuthorTaskRoute } from "../tasks/types";
import type { AuthorToolContributor } from "../tools/types";
import type { CommandReferenceSource } from "../../features/commands/referenceSource";
import type { AuthorOperationDefinition } from "../../features/operations/targetAdapter";
import type { TextCueAuthorAdapter } from "../textCues/types";
import type { AuthorCommandTargetAdapter } from "../commands/types";

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
  /** Resolve feature-owned command-target authoring without coupling Commands to feature internals. */
  resolveCommandTarget: (sourceKind: string) => AuthorCommandTargetAdapter | undefined;
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
  /** Player-command target vocabularies owned by this feature. */
  commandReferences?: readonly CommandReferenceSource[];
  /** Feature-owned destinations for authoring behavior on command targets. */
  commandTargets?: readonly AuthorCommandTargetAdapter[];
  /** Operations this feature exposes on semantic target kinds. */
  operations?: readonly AuthorOperationDefinition[];
  /** Feature-owned condition editors composed by the generic rule UI. */
  conditions?: readonly ConditionAuthorAdapter[];
  /** Feature-owned effect editors composed by the generic rule UI. */
  effects?: readonly EffectAuthorAdapter[];
  /** Feature-owned inline text cues composed by narrative authoring. */
  textCues?: readonly TextCueAuthorAdapter[];
  /** Authored content documents contributed to the shared search index. */
  searchDocuments?: readonly SearchDocumentContribution[];
  /** Outbound project references used for missing-link and lifecycle analysis. */
  references?: readonly ProjectReferenceContribution[];
  /** Optional advanced project settings owned by this module. */
  projectSettings?: readonly AuthorProjectSettingsSection[];
  /** Optional terminal aliases that open a workspace owned by this feature. */
  terminalShortcuts?: readonly AuthorTerminalShortcut[];
  /** Feature-owned, human-readable context for routes shown in the shared task trail. */
  describeTask?: (route: AuthorTaskRoute, snapshot: ProjectSnapshot) => string | null;
  /** Semantic requests this feature can fulfill without direct feature imports. */
  capabilities?: readonly AuthorCapability[];
  /** Optional contextual Author controls rendered beside the live play surface. */
  renderPlaySurface?: (context: AuthorPlaySurfaceContext) => ReactNode | null;
  /** Return a workspace for routes owned by this feature, otherwise null. */
  renderWorkspace?: (route: AuthorTaskRoute, context: AuthorWorkspaceContext) => ReactNode | null;
};
