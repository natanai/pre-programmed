import type { CommandsPlayStateSlice } from "../../features/commands/projectSlice";
import type { InventoryMutationOperation } from "../../features/inventory/mutations";
import type { InventoryPlayStateSlice, InventoryProjectSlice } from "../../features/inventory/projectSlice";
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

export type ProjectSnapshot =
  & CoreProjectSnapshot
  & NarrativeProjectSlice
  & WorldProjectSlice
  & StateProjectSlice
  & InventoryProjectSlice;

export type CorePlayState = {
  sessionStartedAt: number;
};

export type PlayState =
  & CorePlayState
  & NarrativePlayStateSlice
  & StatePlayStateSlice
  & InventoryPlayStateSlice
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
  | InventoryMutationOperation;

export type ProjectMutation = {
  expectedRevision: number;
  description: string;
  operations: MutationOperation[];
};
