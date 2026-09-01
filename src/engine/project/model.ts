import type { CommandsPlayStateSlice } from "../../features/commands/projectSlice";
import type { MediaMutationOperation } from "../../features/media/mutations";
import type { MediaProjectSlice } from "../../features/media/projectSlice";
import type { NarrativeMutationOperation } from "../../features/narrative/mutations";
import type { NarrativePlayStateSlice, NarrativeProjectSlice } from "../../features/narrative/projectSlice";
import type { StateMutationOperation } from "../../features/state/mutations";
import type { StatePlayStateSlice, StateProjectSlice } from "../../features/state/projectSlice";
import type { WorldMutationOperation } from "../../features/world/mutations";
import type { WorldProjectSlice } from "../../features/world/projectSlice";
import type { ProjectSettings } from "./settings";

export type CoreProjectSnapshot = {
  schemaVersion: number;
  revision: number;
  settings: ProjectSettings;
};

/** Explicit project-data composition root for installed features. */
export type ProjectSnapshot =
  & CoreProjectSnapshot
  & NarrativeProjectSlice
  & WorldProjectSlice
  & StateProjectSlice
  & MediaProjectSlice;

export type CorePlayState = {
  sessionStartedAt: number;
};

/** Explicit play-state composition root for installed features. */
export type PlayState =
  & CorePlayState
  & NarrativePlayStateSlice
  & StatePlayStateSlice
  & CommandsPlayStateSlice;

export type AuthorBookmark = {
  id: string;
  nodeId: string;
  traversal: string[];
  playState: PlayState;
  note: string;
  createdAt: string;
};

export type RevisionSummary = {
  revision: number;
  kind: string;
  entityId: string;
  description: string;
  createdAt: string;
};

export type CoreProjectMutationOperation =
  | { type: "project.settings"; settings: ProjectSettings }
  | { type: "bookmark.upsert"; bookmark: AuthorBookmark }
  | { type: "bookmark.delete"; id: string };

export type MutationOperation =
  | CoreProjectMutationOperation
  | NarrativeMutationOperation
  | WorldMutationOperation
  | StateMutationOperation
  | MediaMutationOperation;

export type ProjectMutation = {
  expectedRevision: number;
  description: string;
  operations: MutationOperation[];
};
