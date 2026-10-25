import type { Effect } from "../../engine/rules/model";
import { DEFAULT_PROJECT_DEFAULTS } from "../../engine/project/defaults";
import { isRuntimeBinding, PLAYER_INPUT_BINDING, runtimeBinding } from "../../engine/rules/runtimeBindings";
import type {
  NarrativeFlowStep,
  NodeEntryTarget,
  TextPerformance,
} from "./model";

export const DEFAULT_FLOW_TEXT_PERFORMANCE: TextPerformance = {
  charactersPerSecond: DEFAULT_PROJECT_DEFAULTS.textSpeed,
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

export function createPresentStep(textSpeed = DEFAULT_PROJECT_DEFAULTS.textSpeed): NarrativeFlowStep {
  return {
    id: makeId(),
    type: "present",
    responseText: "",
    dialogueText: "",
    speakerId: null,
    responsePerformance: { charactersPerSecond: textSpeed, cues: [] },
    dialoguePerformance: { charactersPerSecond: textSpeed, cues: [] },
  };
}

export function createTransitionStep(destination: NodeEntryTarget): NarrativeFlowStep {
  return { id: makeId(), type: "transition", destination };
}

export function createReturnPreviousStep(): NarrativeFlowStep {
  return { id: makeId(), type: "return_previous" };
}

/**
 * One-click authoring preset for "wait for the next submission".
 *
 * The preset is deliberately only composition: runtime knows await/effects/
 * present/transition steps, not a separate capture feature. Empty Effects and
 * Present steps are retained so opening the preset immediately exposes the
 * common "save the input, answer it, then continue" workflow.
 */
export function createCaptureInputFlow(textSpeed = DEFAULT_PROJECT_DEFAULTS.textSpeed): NarrativeFlowStep[] {
  return [
    createAwaitInputStep(),
    createEffectsStep(),
    createPresentStep(textSpeed),
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

export function flowReturnsPrevious(flow: readonly NarrativeFlowStep[]) {
  return flow.some((step) => step.type === "return_previous");
}

export function flowDestinations(flow: readonly NarrativeFlowStep[]) {
  return flow.flatMap((step) => step.type === "transition" ? [step.destination] : []);
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
  const without = flow.filter((step) => step.type !== "transition" && step.type !== "return_previous");
  return destination ? [...without, createTransitionStep(destination)] : without;
}

export function replaceFlowReturnPrevious(
  flow: readonly NarrativeFlowStep[],
  enabled: boolean,
): NarrativeFlowStep[] {
  const without = flow.filter((step) => step.type !== "transition" && step.type !== "return_previous");
  return enabled ? [...without, createReturnPreviousStep()] : without;
}

export type CaptureFlowParts = {
  awaitIndex: number;
  effectsIndex: number;
  presentIndex: number;
  awaitStep: Extract<NarrativeFlowStep, { type: "await_input" }>;
  effectsStep: Extract<NarrativeFlowStep, { type: "effects" }>;
  presentStep: Extract<NarrativeFlowStep, { type: "present" }>;
};

export function captureFlowParts(
  flow: readonly NarrativeFlowStep[],
  awaitStepId?: string,
): CaptureFlowParts | null {
  const awaitIndex = awaitStepId
    ? flow.findIndex((step) => step.type === "await_input" && step.id === awaitStepId)
    : flow.findIndex((step) => step.type === "await_input");
  // The capture preset owns the first flow step. Later captures remain in that
  // same owner's ordered steps, not in new Node openings or hidden run states.
  if (awaitIndex < 0 || (!awaitStepId && awaitIndex !== 0)) return null;
  const nextBoundary = flow.findIndex((step, index) => index > awaitIndex
    && (step.type === "await_input" || step.type === "transition" || step.type === "return_previous"));
  const end = nextBoundary < 0 ? flow.length : nextBoundary;
  const effectsIndex = flow.findIndex((step, index) => index > awaitIndex && index < end && step.type === "effects");
  const presentIndex = flow.findIndex((step, index) => index > effectsIndex && index < end && step.type === "present");
  if (effectsIndex < 0 || presentIndex < 0) return null;
  const awaitStep = flow[awaitIndex];
  const effectsStep = flow[effectsIndex];
  const presentStep = flow[presentIndex];
  if (awaitStep.type !== "await_input" || effectsStep.type !== "effects" || presentStep.type !== "present") return null;
  return { awaitIndex, effectsIndex, presentIndex, awaitStep, effectsStep, presentStep };
}

/** Every authored input/reply turn in one canonical Narrative flow. */
export function captureFlowSegments(flow: readonly NarrativeFlowStep[]): CaptureFlowParts[] {
  return flow.flatMap((step) => step.type === "await_input"
    ? [captureFlowParts(flow, step.id)].filter((part): part is CaptureFlowParts => Boolean(part))
    : []);
}

/** Continue after this reply by waiting for one more submission. */
export function appendCaptureTurn(flow: readonly NarrativeFlowStep[], textSpeed = DEFAULT_PROJECT_DEFAULTS.textSpeed): NarrativeFlowStep[] {
  const turns = captureFlowSegments(flow);
  if (!turns.length) return flow.slice();
  const finalPresentIndex = turns[turns.length - 1].presentIndex;
  // Preserve the original final destination: the new turn runs before it.
  return [
    ...flow.slice(0, finalPresentIndex + 1),
    ...createCaptureInputFlow(textSpeed),
    ...flow.slice(finalPresentIndex + 1),
  ];
}

/** Remove only this captured turn's canonical steps; do not erase its siblings. */
export function removeCaptureTurn(flow: readonly NarrativeFlowStep[], awaitStepId: string): NarrativeFlowStep[] {
  const turns = captureFlowSegments(flow);
  if (turns.length < 2) return flow.slice();
  const part = turns.find((item) => item.awaitStep.id === awaitStepId);
  if (!part) return flow.slice();
  return [...flow.slice(0, part.awaitIndex), ...flow.slice(part.presentIndex + 1)];
}

export function replaceCaptureEffects(
  flow: readonly NarrativeFlowStep[],
  effects: Effect[],
  awaitStepId?: string,
): NarrativeFlowStep[] {
  const parts = captureFlowParts(flow, awaitStepId);
  if (!parts) return flow.slice();
  return flow.map((step, index) => index === parts.effectsIndex && step.type === "effects"
    ? { ...step, effects }
    : step);
}

export function replaceCapturePresentation(
  flow: readonly NarrativeFlowStep[],
  present: Extract<NarrativeFlowStep, { type: "present" }>,
  awaitStepId?: string,
): NarrativeFlowStep[] {
  const parts = captureFlowParts(flow, awaitStepId);
  if (!parts) return flow.slice();
  return flow.map((step, index) => index === parts.presentIndex ? present : step);
}

/**
 * The guided capture UI is a compact view onto the *same* canonical Set Value
 * effect held in the flow's existing effects step. No separate capture state,
 * effect evaluator, or persistence path.
 */
export function capturedInputVariableKey(flow: readonly NarrativeFlowStep[], awaitStepId?: string): string {
  const effects = captureFlowParts(flow, awaitStepId)?.effectsStep.effects ?? [];
  const capture = effects.find((effect) => effect.type === "set_value"
    && isRuntimeBinding(effect.value) && effect.value.key === PLAYER_INPUT_BINDING);
  return capture?.type === "set_value" ? capture.key : "";
}

export function replaceCapturedInputVariable(
  flow: readonly NarrativeFlowStep[],
  key: string,
  awaitStepId?: string,
): NarrativeFlowStep[] {
  const parts = captureFlowParts(flow, awaitStepId);
  if (!parts) return flow.slice();
  const effects = [...parts.effectsStep.effects];
  const index = effects.findIndex((effect) => effect.type === "set_value"
    && isRuntimeBinding(effect.value) && effect.value.key === PLAYER_INPUT_BINDING);
  if (index >= 0) {
    if (key) {
      const current = effects[index];
      if (current.type === "set_value") effects[index] = { ...current, key };
    } else effects.splice(index, 1);
  } else if (key) {
    effects.unshift({ id: crypto.randomUUID(), type: "set_value", key, value: runtimeBinding(PLAYER_INPUT_BINDING) });
  }
  return replaceCaptureEffects(flow, effects, awaitStepId);
}

/** Context used by the canonical Effects editor for the segment after await input. */
export const CAPTURE_EFFECT_AUTHORING_CONTEXT = {
  preferredRuntimeBindingKey: PLAYER_INPUT_BINDING,
} as const;
