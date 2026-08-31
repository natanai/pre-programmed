import type { Condition, Effect } from "../../engine/rules/model";

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
  responseCharactersPerSecond?: number;
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
