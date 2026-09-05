import type { TextCueType } from "../../engine/presentation/textCueTypes";
import type { Condition, Effect } from "../../engine/rules/model";

export type { TextCueType } from "../../engine/presentation/textCueTypes";

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

/** Shared authored traversal behavior for persistent Node context. */
export type NodeContextMode = "set" | "continue" | "clear";
export type NodeAnchorMode = NodeContextMode;
export type NodeLocationMode = NodeContextMode;

export type NodeAnchor = {
  mode: NodeAnchorMode;
  text: string;
};

/**
 * A hand-authored set of characters established by one Node. Missing legacy
 * values mean Continue, so branching Nodes inherit the path that reached them.
 */
export type NodeCharacterContext = {
  mode: NodeContextMode;
  characterIds: string[];
};

export type GameNode = {
  id: string;
  nodeNumber: number;
  text: string;
  ending: boolean;
  tags: string[];
  /** Character whose voice presents this node text; null means unattributed/narration. */
  characterId: string | null;
  /** Location selected when `locationMode` is `set`. */
  locationId: string | null;
  /**
   * Persistent scene context authored by this Node. Missing legacy values mean
   * Set when a locationId exists, otherwise Continue.
   */
  locationMode?: NodeLocationMode;
  /** Characters available in this authored moment. Missing legacy values mean Continue. */
  presentCharacters?: NodeCharacterContext;
  /** Characters the player is currently engaged in conversation with. Missing legacy values mean Continue. */
  conversation?: NodeCharacterContext;
  /** Persistent player-facing anchor context. Missing legacy values mean Continue. */
  anchor?: NodeAnchor;
  performance: TextPerformance;
};

export type InteractionDisposition = "stay" | "transition";
export type InteractionChoiceVisibility = "immediate" | "prompt" | "typed";
/**
 * command: match authored wording/aliases.
 * capture: accept otherwise-unmatched player text at this node.
 * fallback: invalid-input response after every valid input mechanism declines it.
 */
export type InteractionMatchMode = "command" | "capture" | "fallback";

export type InteractionOutcome = {
  id: string;
  order: number;
  label: string;
  authorStatus: "draft" | "configured";
  condition: Condition;
  responseText: string;
  /** Optional character voice for this response; missing/null means unattributed narration. */
  speakerId?: string | null;
  /** The same authored-text performance contract used by node prose. */
  responsePerformance: TextPerformance;
  effects: Effect[];
  disposition: InteractionDisposition;
  destinationNodeId: string | null;
};

export type Interaction = {
  id: string;
  sourceNodeId: string;
  wording: string;
  matchMode?: InteractionMatchMode;
  /** Where an otherwise visible choice is presented. Typed matching never depends on this field. */
  choiceVisibility: InteractionChoiceVisibility;
  /** Whether the engine should suggest this input as a player choice. Typed matching remains valid when false. */
  choiceVisibleWhen?: Condition;
  aliases: string[];
  tags: string[];
  notes: string;
  outcomes: InteractionOutcome[];
};