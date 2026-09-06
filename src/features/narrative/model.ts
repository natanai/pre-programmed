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

/** Shared authored traversal behavior for lightweight persistent Node context. */
export type NodeContextMode = "set" | "continue" | "clear";
export type NodeAnchorMode = NodeContextMode;
export type NodeLocationMode = NodeContextMode;
export type NodeConversationMode = NodeContextMode;

export type NodeAnchor = {
  mode: NodeAnchorMode;
  text: string;
};

export type GameNode = {
  id: string;
  nodeNumber: number;
  /** Optional narration shown before this Node's conversation character speaks. */
  text: string;
  /** Optional line spoken by the traversal-derived conversation character. */
  dialogueText?: string;
  ending: boolean;
  tags: string[];
  /**
   * Legacy input only. Current Node persistence strips this former Speaker field
   * after migrating its text/identity into conversation + dialogue.
   */
  characterId?: string | null;
  /** Location selected when `locationMode` is `set`. */
  locationId: string | null;
  /** Missing legacy values mean Set when a locationId exists, otherwise Continue. */
  locationMode?: NodeLocationMode;
  /** Character selected when `conversationMode` is `set`. */
  conversationCharacterId?: string | null;
  /** Missing values mean Continue, so branching Nodes inherit the path that reached them. */
  conversationMode?: NodeConversationMode;
  /** Persistent player-facing anchor context. Missing legacy values mean Continue. */
  anchor?: NodeAnchor;
  /** Effects executed once whenever runtime traversal enters this Node. */
  entryEffects?: Effect[];
  /** Narration delivery. */
  performance: TextPerformance;
  /** Dialogue delivery; missing legacy values use the normal default performance. */
  dialoguePerformance?: TextPerformance;
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
  /** Optional narration shown before this response's spoken line. */
  responseText: string;
  /** Optional spoken line. In a conversation, the source Node's conversation character owns the voice. */
  dialogueText?: string;
  /** Explicit fallback voice only when the source Node is not in an active conversation. */
  speakerId?: string | null;
  /** Narration delivery. */
  responsePerformance: TextPerformance;
  /** Spoken-line delivery. */
  dialoguePerformance?: TextPerformance;
  effects: Effect[];
  disposition: InteractionDisposition;
  destinationNodeId: string | null;
};

export type Interaction = {
  id: string;
  sourceNodeId: string;
  /** Durable authored position among the source Node's valid-input siblings. */
  order: number;
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
