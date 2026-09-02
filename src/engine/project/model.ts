import type { CommandsPlayStateSlice } from "../../features/commands/projectSlice";
import type { EquipmentMutationOperation } from "../../features/equipment/mutations";
import type { EquipmentPlayStateSlice, EquipmentProjectSlice } from "../../features/equipment/projectSlice";
import type { InventoryMutationOperation } from "../../features/inventory/mutations";
import type { InventoryPlayStateSlice, InventoryProjectSlice } from "../../features/inventory/projectSlice";
import type { MediaMutationOperation } from "../../features/media/mutations";
import type { MediaProjectSlice } from "../../features/media/projectSlice";
import type { NarrativeMutationOperation } from "../../features/narrative/mutations";
import type { NarrativePlayStateSlice, NarrativeProjectSlice } from "../../features/narrative/projectSlice";
import type { StatusMutationOperation } from "../../features/status/mutations";
import type { StatusProjectSlice } from "../../features/status/projectSlice";
import type { ValuesMutationOperation } from "../../features/values/mutations";
import type { ValuesPlayStateSlice, ValuesProjectSlice } from "../../features/values/projectSlice";
import type { WorldMutationOperation } from "../../features/world/mutations";
import type { WorldProjectSlice } from "../../features/world/projectSlice";
import type { ProjectSettings } from "./settings";

export type CoreProjectSnapshot = { schemaVersion: number; revision: number; settings: ProjectSettings };

export type ProjectSnapshot =
  & CoreProjectSnapshot
  & NarrativeProjectSlice
  & WorldProjectSlice
  & ValuesProjectSlice
  & StatusProjectSlice
  & InventoryProjectSlice
  & EquipmentProjectSlice
  & MediaProjectSlice;

export type CorePlayState = { sessionStartedAt: number };
export type PlayState =
  & CorePlayState
  & NarrativePlayStateSlice
  & ValuesPlayStateSlice
  & InventoryPlayStateSlice
  & EquipmentPlayStateSlice
  & CommandsPlayStateSlice;

export type AuthorBookmark = { id: string; nodeId: string; traversal: string[]; playState: PlayState; note: string; createdAt: string };
export type RevisionSummary = { revision: number; kind: string; entityId: string; description: string; createdAt: string };

export type CoreProjectMutationOperation =
  | { type: "project.settings"; settings: ProjectSettings }
  | { type: "bookmark.upsert"; bookmark: AuthorBookmark }
  | { type: "bookmark.delete"; id: string };

export type MutationOperation =
  | CoreProjectMutationOperation
  | NarrativeMutationOperation
  | WorldMutationOperation
  | ValuesMutationOperation
  | StatusMutationOperation
  | InventoryMutationOperation
  | EquipmentMutationOperation
  | MediaMutationOperation;

export type ProjectMutation = { expectedRevision: number; description: string; operations: MutationOperation[] };
