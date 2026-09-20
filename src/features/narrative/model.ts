import type { TextCueType } from "../../engine/presentation/textCueTypes";
import type { ConditionalSelectionMode } from "../../engine/rules/conditionalSelection";
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

/**
 * One player-facing presentation owned by a Node. Openings are stable,
 * addressable children of the Node; their prose is presentation, never Node identity.
 */
export type NodeOpening = {
  id: string;
  order: number;
  condition: Condition;
  narrationText: string;
  dialogueText: string;
  narrationPerformance: TextPerformance;
  dialoguePerformance: TextPerformance;
  /** Ordered engine actions that continue after this opening finishes presenting. */
  after: NarrativeFlowStep[];
};

export type GameNode = {
  /** Stable graph identity. Links always target this id, never prose or labels. */
  id: string;
  /** Stable author locator used for exact-number search. */
  nodeNumber: number;
  /** Private, renameable author-facing name; never shown to the player. */
  authorLabel: string;
  /** Ordered conditional presentations evaluated whenever traversal enters this Node. */
  openings: NodeOpening[];
  ending: boolean;
  tags: string[];
  /** Location selected when `locationMode` is `set`. */
  locationId: string | null;
  /** Missing historical values mean Set when a locationId exists, otherwise Continue. */
  locationMode?: NodeLocationMode;
  /** Character selected when `conversationMode` is `set`. */
  conversationCharacterId?: string | null;
  /** Missing historical values mean Continue, so branching Nodes inherit the path that reached them. */
  conversationMode?: NodeConversationMode;
  /** Persistent player-facing anchor context. Missing historical values mean Continue. */
  anchor?: NodeAnchor;
  /** Effects executed once whenever runtime traversal enters this Node. */
  entryEffects?: Effect[];
};

export type NodeEntryTarget = {
  nodeId: string;
  /** Null means AUTO: let the destination Node select its opening from current conditions. */
  openingId: string | null;
};

export type InteractionChoiceVisibility = "immediate" | "prompt" | "typed";
/**
 * command: match authored wording/aliases.
 * fallback: invalid-input response after every valid input mechanism declines it.
 *
 * Player-input capture is not an Interaction matching mode. It is an ordinary
 * Narrative flow step so the same wait/effect/present/continue sequence can be
 * nested after responses and Node openings.
 */
export type InteractionMatchMode = "command" | "fallback";

export type NarrativeFlowStep =
  | {
      id: string;
      type: "await_input";
    }
  | {
      id: string;
      type: "effects";
      effects: Effect[];
    }
  | {
      id: string;
      type: "present";
      responseText: string;
      dialogueText: string;
      speakerId: string | null;
      responsePerformance: TextPerformance;
      dialoguePerformance: TextPerformance;
    }
  | {
      id: string;
      type: "transition";
      destination: NodeEntryTarget;
    }
  | {
      id: string;
      /** Pop one real traversal frame and re-enter that Node through AUTO selection. */
      type: "return_previous";
    };

export type NarrativeFlowOwner =
  | { type: "interaction-outcome"; interactionId: string; outcomeId: string }
  | { type: "node-opening"; nodeId: string; openingId: string };

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
  /**
   * Ordered continuation owned by this response. Empty means stay here.
   * AFTER presets are authoring shortcuts that compose this one flow rather
   * than separate runtime behaviors.
   */
  after: NarrativeFlowStep[];
};

export type Interaction = {
  id: string;
  sourceNodeId: string;
  /** Durable authored position among the source Node's valid-input siblings. Historical snapshots may omit it. */
  order?: number;
  wording: string;
  matchMode?: InteractionMatchMode;
  /** How this input chooses among all response outcomes whose conditions currently match. */
  outcomeSelection?: ConditionalSelectionMode;
  /** Where an otherwise visible choice is presented. Typed matching never depends on this field. */
  choiceVisibility: InteractionChoiceVisibility;
  /** Whether the engine should suggest this input as a player choice. Typed matching remains valid when false. */
  choiceVisibleWhen?: Condition;
  aliases: string[];
  tags: string[];
  notes: string;
  outcomes: InteractionOutcome[];
};
