import type { Value } from "../rules/model";
import type { InventoryEntry, ItemDefinition } from "../../features/inventory/model";
import type { InventoryMutationOperation } from "../../features/inventory/mutations";
import type { SynthSound } from "../../features/media/model";
import type { MediaMutationOperation } from "../../features/media/mutations";
import type { GameNode, Interaction } from "../../features/narrative/model";
import type { NarrativeMutationOperation } from "../../features/narrative/mutations";
import type { ComputedDefinition, VariableDefinition } from "../../features/state/model";
import type { StateMutationOperation } from "../../features/state/mutations";
import type { EntityDefinition } from "../../features/world/model";
import type { WorldMutationOperation } from "../../features/world/mutations";
import type { ProjectSettings } from "./settings";

export type ProjectSnapshot = {
  schemaVersion: number;
  revision: number;
  startNodeId: string;
  settings: ProjectSettings;
  nodes: GameNode[];
  interactions: Interaction[];
  entities: EntityDefinition[];
  variables: VariableDefinition[];
  computedValues: ComputedDefinition[];
  items: ItemDefinition[];
  synthSounds: SynthSound[];
};

export type PlayState = {
  currentNodeId: string;
  traversal: string[];
  values: Record<string, Value>;
  attempts: Record<string, number>;
  inventory: InventoryEntry[];
  visitedNodeIds: string[];
  interactionVisibility: Record<string, boolean>;
  sessionStartedAt: number;
  variableTimeUpdatedAt: number;
  commandsEntered: number;
  lastCommand: string;
};

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
