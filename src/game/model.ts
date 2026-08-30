import { addInventoryItem } from "./inventory";

export type Value = string | number | boolean | null;

export type TextCueType =
  | "pause"
  | "speed"
  | "wave"
  | "shake"
  | "blink"
  | "instant"
  | "synth"
  | "audio"
  | "sprite";

export type TextCue = {
  id: string;
  type: TextCueType;
  start: number;
  end: number;
  value?: string | number | boolean;
};

export type TextPerformance = {
  charactersPerSecond: number;
  cues: TextCue[];
};

export type GameNode = {
  id: string;
  nodeNumber: number;
  text: string;
  ending: boolean;
  tags: string[];
  characterId: string | null;
  locationId: string | null;
  performance: TextPerformance;
};

export type EntityDefinition = {
  id: string;
  key: string;
  type: "character" | "location";
  name: string;
  description: string;
  tags: string[];
};

export type ComparisonOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

export type Condition =
  | { type: "always" }
  | { type: "all"; conditions: Condition[] }
  | { type: "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition }
  | { type: "has_item"; itemId: string; minimum?: number }
  | { type: "lacks_item"; itemId: string }
  | { type: "flag"; key: string; value: boolean }
  | { type: "variable"; key: string; operator: ComparisonOperator; value: Value }
  | { type: "attempt"; eventKey?: string; operator: ComparisonOperator; value: number }
  | { type: "visited"; nodeId: string; value: boolean }
  | { type: "state"; field: "currentNodeId" | "lastCommand"; operator: "eq" | "neq"; value: string };

export type Effect =
  | { id: string; type: "set_flag"; key: string }
  | { id: string; type: "clear_flag"; key: string }
  | { id: string; type: "set_value"; key: string; value: Value }
  | { id: string; type: "increment"; key: string; amount: number }
  | { id: string; type: "decrement"; key: string; amount: number }
  | { id: string; type: "give_item"; itemId: string; quantity: number }
  | { id: string; type: "remove_item"; itemId: string; quantity: number }
  | { id: string; type: "set_item_state"; itemId: string; key: string; value: Value }
  | { id: string; type: "set_interaction_visibility"; interactionId: string; visible: boolean }
  | { id: string; type: "notification"; text: string }
  | { id: string; type: "synth"; synthId: string }
  | { id: string; type: "audio"; assetPath: string }
  | { id: string; type: "art"; assetPath: string }
  | { id: string; type: "transition"; nodeId: string };

export type InteractionDisposition = "stay" | "transition";

export type InteractionChoiceVisibility = "immediate" | "prompt" | "typed";

export type InteractionOutcome = {
  id: string;
  order: number;
  label: string;
  authorStatus: "draft" | "configured";
  condition: Condition;
  responseText: string;
  effects: Effect[];
  disposition: InteractionDisposition;
  destinationNodeId: string | null;
};

export type Interaction = {
  id: string;
  sourceNodeId: string;
  wording: string;
  choiceVisibility: InteractionChoiceVisibility;
  aliases: string[];
  tags: string[];
  notes: string;
  outcomes: InteractionOutcome[];
};

export type VariableDefinition = {
  id: string;
  key: string;
  label: string;
  valueType: "number" | "boolean" | "string";
  initialValue: Value;
  showInStatus: boolean;
  interactable: boolean;
  operations: InventoryOperation[];
  hooks: OperationHook[];
};

export type ComputedSource =
  | "elapsed_seconds"
  | "commands_entered"
  | "inventory_slots_used"
  | "visited_nodes";

export type ComputedDefinition = {
  id: string;
  key: string;
  label: string;
  source: ComputedSource;
  format: "raw" | "integer" | "seconds";
  showInStatus: boolean;
  interactable: boolean;
  operations: InventoryOperation[];
  hooks: OperationHook[];
};

export type InventoryOperation = "inspect" | "use" | "move" | "remove";

export type OperationHook = {
  id: string;
  operation: InventoryOperation;
  order: number;
  condition: Condition;
  responseText: string;
  effects: Effect[];
  success: boolean;
};

/** Retained as a source-compatible name for existing item authoring code. */
export type ItemOperationHook = OperationHook;

export type OperationTarget =
  | { kind: "item"; id: string }
  | { kind: "variable"; id: string }
  | { kind: "computed"; id: string };

export type ItemDefinition = {
  id: string;
  key: string;
  name: string;
  description: string;
  assetPath: string;
  width: number;
  height: number;
  stackable: boolean;
  maxStack: number;
  removable: boolean;
  startingQuantity: number;
  interactable: boolean;
  operations: InventoryOperation[];
  tags: string[];
  initialState: Record<string, Value>;
  hooks: OperationHook[];
};

export type SynthStep = {
  active: boolean;
  note: string;
  volume: number;
};

export type SynthVoice = {
  waveform: "square" | "triangle" | "sawtooth" | "sine" | "noise";
  attack: number;
  release: number;
  steps: SynthStep[];
};

export type SynthSound = {
  id: string;
  key: string;
  label: string;
  tempo: number;
  loop: boolean;
  voices: SynthVoice[];
};

export type ProjectSnapshot = {
  schemaVersion: number;
  revision: number;
  startNodeId: string;
  nodes: GameNode[];
  interactions: Interaction[];
  entities: EntityDefinition[];
  variables: VariableDefinition[];
  computedValues: ComputedDefinition[];
  items: ItemDefinition[];
  synthSounds: SynthSound[];
};

export type InventoryEntry = {
  instanceId: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  state: Record<string, Value>;
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

export function createEmptyPlayState(snapshot: ProjectSnapshot, now = Date.now()): PlayState {
  let state: PlayState = {
    currentNodeId: snapshot.startNodeId,
    traversal: [snapshot.startNodeId],
    values: Object.fromEntries(snapshot.variables.map((definition) => [definition.key, definition.initialValue])),
    attempts: {},
    inventory: [],
    visitedNodeIds: [snapshot.startNodeId],
    interactionVisibility: {},
    sessionStartedAt: now,
    commandsEntered: 0,
    lastCommand: "",
  };
  for (const item of snapshot.items) {
    state = addInventoryItem(snapshot, state, item.id, item.startingQuantity ?? 0);
  }
  return state;
}

export function reconcilePlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  return {
    ...state,
    values: {
      ...Object.fromEntries(snapshot.variables.map((definition) => [definition.key, definition.initialValue])),
      ...state.values,
    },
  };
}

export function nextNodeNumber(snapshot: ProjectSnapshot) {
  return snapshot.nodes.reduce((maximum, node) => Math.max(maximum, node.nodeNumber), 0) + 1;
}

export function makeId() {
  return crypto.randomUUID();
}

export const ALWAYS: Condition = { type: "always" };
