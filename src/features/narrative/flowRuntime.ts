import { authoredSource, type AuthoredSourceIdentity } from "../../engine/presentation/authoredSource";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { executeEffects } from "../../engine/rules/executeEffects";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import type { RuntimeBindings } from "../../engine/rules/runtimeBindings";
import { PLAYER_INPUT_BINDING } from "../../engine/rules/runtimeBindings";
import { transitionState } from "./effectRuntime";
import { interpolateText } from "./interpolation";
import type {
  NarrativeFlowOwner,
  NarrativeFlowStep,
  TextPerformance,
} from "./model";
import { executeNodeEntryEffects } from "./nodeEntryRuntime";
import { resolveNodeConversationContext } from "./sceneContext";

const DEFAULT_PERFORMANCE: TextPerformance = { charactersPerSecond: 18, cues: [] };

export type NarrativeFlowExecution = {
  state: PlayState;
  events: EffectEvent[];
  responseText: string;
  responsePerformance: TextPerformance;
  dialogueText: string;
  dialoguePerformance: TextPerformance;
  dialogueSpeakerId: string | null;
  source?: AuthoredSourceIdentity;
};

type ResolvedFlowOwner = {
  flow: NarrativeFlowStep[];
  scopeNodeId: string;
  sourceResourceKind: "interaction" | "node";
  sourceResourceId: string;
  focus: Readonly<Record<string, string>>;
};

export function flowForOwner(
  snapshot: ProjectSnapshot,
  owner: NarrativeFlowOwner,
): ResolvedFlowOwner | null {
  if (owner.type === "interaction-outcome") {
    const interaction = snapshot.interactions.find((candidate) => candidate.id === owner.interactionId);
    const outcome = interaction?.outcomes.find((candidate) => candidate.id === owner.outcomeId);
    if (!interaction || !outcome) return null;
    return {
      flow: outcome.after,
      scopeNodeId: interaction.sourceNodeId,
      sourceResourceKind: "interaction",
      sourceResourceId: interaction.id,
      focus: { outcomeId: outcome.id },
    };
  }

  const node = snapshot.nodes.find((candidate) => candidate.id === owner.nodeId);
  const opening = node?.openings.find((candidate) => candidate.id === owner.openingId);
  if (!node || !opening) return null;
  return {
    flow: opening.after,
    scopeNodeId: node.id,
    sourceResourceKind: "node",
    sourceResourceId: node.id,
    focus: { openingId: opening.id },
  };
}

export function armNarrativeFlow(
  state: PlayState,
  owner: NarrativeFlowOwner,
  bindings: RuntimeBindings = {},
): PlayState {
  return {
    ...state,
    pendingNarrativeFlow: {
      owner,
      stepIndex: 0,
      mode: "auto",
      bindings: { ...bindings },
    },
  };
}

function blankExecution(state: PlayState): NarrativeFlowExecution {
  return {
    state,
    events: [],
    responseText: "",
    responsePerformance: { ...DEFAULT_PERFORMANCE, cues: [] },
    dialogueText: "",
    dialoguePerformance: { ...DEFAULT_PERFORMANCE, cues: [] },
    dialogueSpeakerId: null,
  };
}

function sourceFor(
  owner: ResolvedFlowOwner,
  step: NarrativeFlowStep,
  section: string,
) {
  return authoredSource(owner.sourceResourceKind, owner.sourceResourceId, {
    ...owner.focus,
    section,
    flowStepId: step.id,
  });
}

/**
 * Advance one canonical Narrative flow until it either waits for player input,
 * emits one presentation, or reaches the end. A presentation suspends the
 * remaining steps in auto mode so the App resumes them only after that text
 * finishes, preserving authored ordering without feature-specific callbacks.
 */
export function advanceNarrativeFlow(
  snapshot: ProjectSnapshot,
  initialState: PlayState,
  ownerRef: NarrativeFlowOwner,
  startIndex = 0,
  bindings: RuntimeBindings = {},
): NarrativeFlowExecution {
  const owner = flowForOwner(snapshot, ownerRef);
  if (!owner) return blankExecution({ ...initialState, pendingNarrativeFlow: null });

  let state: PlayState = { ...initialState, pendingNarrativeFlow: null };
  const events: EffectEvent[] = [];
  const initialNodeId = initialState.currentNodeId;
  const initialTraversalLength = initialState.traversal.length;

  for (let index = startIndex; index < owner.flow.length; index += 1) {
    const step = owner.flow[index];

    if (step.type === "await_input") {
      state = {
        ...state,
        pendingNarrativeFlow: {
          owner: ownerRef,
          stepIndex: index,
          mode: "input",
          bindings: { ...bindings },
        },
      };
      break;
    }

    if (step.type === "effects") {
      const execution = executeEffects(snapshot, state, step.effects, {
        bindings,
        scope: { kind: "node", id: owner.scopeNodeId },
      });
      state = execution.state;
      const effectSource = sourceFor(owner, step, "flow-effects");
      events.push(...execution.events.map((event) => {
        const next = event.type === "notification"
          ? { ...event, text: interpolateText(event.text, { snapshot, state }) }
          : event;
        return { ...next, source: effectSource };
      }));
      continue;
    }

    if (step.type === "transition") {
      state = transitionState(state, step.destination);
      continue;
    }

    const responseText = interpolateText(step.responseText, { snapshot, state });
    const dialogueText = interpolateText(step.dialogueText, { snapshot, state });
    const sourceConversation = resolveNodeConversationContext(snapshot, state, owner.scopeNodeId);
    const source = sourceFor(owner, step, responseText ? "flow-narration" : "flow-dialogue");
    state = index + 1 < owner.flow.length
      ? {
          ...state,
          pendingNarrativeFlow: {
            owner: ownerRef,
            stepIndex: index + 1,
            mode: "auto",
            bindings: { ...bindings },
          },
        }
      : { ...state, pendingNarrativeFlow: null };

    const enteredNode = state.currentNodeId !== initialNodeId
      || state.traversal.length > initialTraversalLength;
    const entry = enteredNode
      ? executeNodeEntryEffects(snapshot, state, state.currentNodeId)
      : { state, events: [] };

    return {
      state: entry.state,
      events: [...events, ...entry.events],
      responseText,
      responsePerformance: step.responsePerformance,
      dialogueText,
      dialoguePerformance: step.dialoguePerformance,
      dialogueSpeakerId: sourceConversation?.characterId ?? step.speakerId,
      source,
    };
  }

  const enteredNode = state.currentNodeId !== initialNodeId
    || state.traversal.length > initialTraversalLength;
  const entry = enteredNode
    ? executeNodeEntryEffects(snapshot, state, state.currentNodeId)
    : { state, events: [] };

  return {
    ...blankExecution(entry.state),
    events: [...events, ...entry.events],
  };
}

export function resumeNarrativeFlowAfterPresentation(
  snapshot: ProjectSnapshot,
  state: PlayState,
): NarrativeFlowExecution | null {
  const pending = state.pendingNarrativeFlow;
  if (!pending || pending.mode !== "auto") return null;
  return advanceNarrativeFlow(snapshot, state, pending.owner, pending.stepIndex, pending.bindings);
}

export function resumeNarrativeFlowWithInput(
  snapshot: ProjectSnapshot,
  state: PlayState,
  input: string,
): NarrativeFlowExecution | null {
  const pending = state.pendingNarrativeFlow;
  if (!pending || pending.mode !== "input") return null;
  const owner = flowForOwner(snapshot, pending.owner);
  if (!owner || owner.flow[pending.stepIndex]?.type !== "await_input") {
    return blankExecution({ ...state, pendingNarrativeFlow: null });
  }
  return advanceNarrativeFlow(snapshot, state, pending.owner, pending.stepIndex + 1, {
    ...pending.bindings,
    [PLAYER_INPUT_BINDING]: input,
  });
}

export function narrativeFlowIsWaitingForInput(state: PlayState | null) {
  return state?.pendingNarrativeFlow?.mode === "input";
}
