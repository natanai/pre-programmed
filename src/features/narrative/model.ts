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

export type GameNode = {
  id: string;
  nodeNumber: number;
  text: string;
  ending: boolean;
  tags: string[];
  /** Character whose voice presents this node text; null means unattributed/narration. */
  characterId: string | null;
  locationId: string | null;
  performance: TextPerformance;
};

export type InteractionDisposition = "stay" | "transition";
export type InteractionChoiceVisibility = "immediate" | "prompt" | "typed";
export type InteractionMatchMode = "command" | "fallback";

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
  choiceVisibility: InteractionChoiceVisibility;
  aliases: string[];
  tags: string[];
  notes: string;
  outcomes: InteractionOutcome[];
};
