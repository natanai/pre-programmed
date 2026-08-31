import type { Value } from "../rules/model";
import type { InventoryEntry, ItemDefinition } from "../../features/inventory/model";
import type { SynthSound } from "../../features/media/model";
import type { GameNode, Interaction } from "../../features/narrative/model";
import type { ComputedDefinition, VariableDefinition } from "../../features/state/model";
import type { EntityDefinition } from "../../features/world/model";
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

export type MutationOperation =
  | { type: "project.settings"; settings: ProjectSettings }
  | { type: "node.upsert"; node: GameNode }
  | { type: "interaction.upsert"; interaction: Interaction }
  | { type: "interaction.delete"; id: string }
  | { type: "entity.upsert"; entity: EntityDefinition }
  | { type: "variable.upsert"; definition: VariableDefinition }
  | { type: "computed.upsert"; definition: ComputedDefinition }
  | { type: "item.upsert"; item: ItemDefinition }
  | { type: "synth.upsert"; sound: SynthSound }
  | { type: "bookmark.upsert"; bookmark: AuthorBookmark }
  | { type: "bookmark.delete"; id: string };

export type ProjectMutation = {
  expectedRevision: number;
  description: string;
  operations: MutationOperation[];
};
