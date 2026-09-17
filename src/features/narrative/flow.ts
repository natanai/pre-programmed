import type { Effect } from "../../engine/rules/model";
import { PLAYER_INPUT_BINDING } from "../../engine/rules/runtimeBindings";
import type {
  NarrativeFlowStep,
  NodeEntryTarget,
  TextPerformance,
} from "./model";

export const DEFAULT_FLOW_TEXT_PERFORMANCE: TextPerformance = {
  charactersPerSecond: 18,
  cues: [],
};

function makeId() {
  return crypto.randomUUID();
}

export function createAwaitInputStep(): NarrativeFlowStep {
  return { id: makeId(), type: "await_input" };
}

export function createEffectsStep(effects: Effect[] = []): NarrativeFlowStep {
  return { id: makeId(), type: "effects", effects };
}

export function createPresentStep(): NarrativeFlowStep {
  return {
    id: makeId(),
    type: "present",
    responseText: "",
    dialogueText: "",
    speakerId: null,
    responsePerformance: { ...DEFAULT_FLOW_TEXT_PERFORMANCE, cues: [] },
    dialoguePerformance: { ...DEFAULT_FLOW_TEXT_PERFORMANCE, cues: [] },
  };
}

export function createTransitionStep(destination: NodeEntryTarget): NarrativeFlowStep {
  return { id: makeId(), type: "transition", destination };
}

/**
 * One-click authoring preset for "wait for the next submission".
 *
 * The preset is deliberately only composition: runtime knows await/effects/
 * present/transition steps, not a separate capture feature. Empty Effects and
 * Present steps are retained so opening the preset immediately exposes the
 * common "save the input, answer it, then continue" workflow.
 */
export function createCaptureInputFlow(): NarrativeFlowStep[] {
  return [
    createAwaitInputStep(),
    createEffectsStep(),
    createPresentStep(),
  ];
}

export function flowTransition(flow: readonly NarrativeFlowStep[]) {
  return [...flow].reverse().find(
    (step): step is Extract<NarrativeFlowStep, { type: "transition" }> => step.type === "transition",
  ) ?? null;
}

export function flowDestination(flow: readonly NarrativeFlowStep[]) {
  return flowTransition(flow)?.destination ?? null;
}

export function flowAwaitsInput(flow: readonly NarrativeFlowStep[]) {
  return flow.some((step) => step.type === "await_input");
}

export function flowEffectsCount(flow: readonly NarrativeFlowStep[]) {
  return flow.reduce((total, step) => total + (step.type === "effects" ? step.effects.length : 0), 0);
}

export function replaceFlowTransition(
  flow: readonly NarrativeFlowStep[],
  destination: NodeEntryTarget | null,
): NarrativeFlowStep[] {
  const without = flow.filter((step) => step.type !== "transition");
  return destination ? [...without, createTransitionStep(destination)] : without;
}

export type CaptureFlowParts = {
  awaitIndex: number;
  effectsIndex: number;
  presentIndex: number;
  awaitStep: Extract<NarrativeFlowStep, { type: "await_input" }>;
  effectsStep: Extract<NarrativeFlowStep, { type: "effects" }>;
  presentStep: Extract<NarrativeFlowStep, { type: "present" }>;
};

export function captureFlowParts(flow: readonly NarrativeFlowStep[]): CaptureFlowParts | null {
  const awaitIndex = flow.findIndex((step) => step.type === "await_input");
  if (awaitIndex !== 0) return null;
  const effectsIndex = flow.findIndex((step, index) => index > awaitIndex && step.type === "effects");
  const presentIndex = flow.findIndex((step, index) => index > awaitIndex && step.type === "present");
  if (effectsIndex < 0 || presentIndex < 0) return null;
  const awaitStep = flow[awaitIndex];
  const effectsStep = flow[effectsIndex];
  const presentStep = flow[presentIndex];
  if (awaitStep.type !== "await_input" || effectsStep.type !== "effects" || presentStep.type !== "present") return null;
  return { awaitIndex, effectsIndex, presentIndex, awaitStep, effectsStep, presentStep };
}

export function replaceCaptureEffects(
  flow: readonly NarrativeFlowStep[],
  effects: Effect[],
): NarrativeFlowStep[] {
  const parts = captureFlowParts(flow);
  if (!parts) return flow.slice();
  return flow.map((step, index) => index === parts.effectsIndex && step.type === "effects"
    ? { ...step, effects }
    : step);
}

export function replaceCapturePresentation(
  flow: readonly NarrativeFlowStep[],
  present: Extract<NarrativeFlowStep, { type: "present" }>,
): NarrativeFlowStep[] {
  const parts = captureFlowParts(flow);
  if (!parts) return flow.slice();
  return flow.map((step, index) => index === parts.presentIndex ? present : step);
}

/** Context used by the canonical Effects editor for the segment after await input. */
export const CAPTURE_EFFECT_AUTHORING_CONTEXT = {
  preferredRuntimeBindingKey: PLAYER_INPUT_BINDING,
} as const;
