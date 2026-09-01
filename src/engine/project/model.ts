import type { CommandsPlayStateSlice } from "../../features/commands/projectSlice";
import type { InventoryMutationOperation } from "../../features/inventory/mutations";
import type { InventoryPlayStateSlice, InventoryProjectSlice } from "../../features/inventory/projectSlice";
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

/**
 * Explicit project-data composition root. Runtime shape remains flat for source
 * compatibility while field ownership lives beside installed features.
 */
export type ProjectSnapshot =
  & CoreProjectSnapshot
  & NarrativeProjectSlice
  & WorldProjectSlice
  & StateProjectSlice
  & InventoryProjectSlice
  & MediaProjectSlice;

export type CorePlayState = {
  sessionStartedAt: number;
};

/**
 * Explicit play-state composition root. Existing callers keep the same flat
 * state shape while each feature owns the fields it introduces.
 */
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

/** Core-owned project mutation payloads. Feature payloads live beside features. */
export type CoreProjectMutationOperation =
  | { type: "project.settings"; settings: ProjectSettings }
  | { type: "bookmark.upsert"; bookmark: AuthorBookmark }
  | { type: "bookmark.delete"; id: string };

/**
 * Explicit mutation composition root.
 *
 * Core owns revision/concurrency and composes installed feature mutation
 * contracts; it no longer defines the payload shape of each feature mutation.
 */
export type MutationOperation =
  | CoreProjectMutationOperation
  | NarrativeMutationOperation
  | WorldMutationOperation
  | StateMutationOperation
  | InventoryMutationOperation
  | MediaMutationOperation;

export type ProjectMutation = {
  expectedRevision: number;
  description: string;
  operations: MutationOperation[];
};
