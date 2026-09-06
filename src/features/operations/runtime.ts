import type { AuthoredSourceIdentity } from "../../engine/presentation/authoredSource";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { evaluateCondition } from "../../engine/rules/conditions";
import type { Effect } from "../../engine/rules/model";
import { executeEffects } from "../../engine/rules/executeEffects";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import {
  OPERATION_ARGUMENT_BINDING_PREFIX,
  OPERATION_TARGET_ID_BINDING,
  OPERATION_TARGET_KIND_BINDING,
  PLAYER_INPUT_BINDING,
} from "../../engine/rules/runtimeBindings";
import { interpolateText } from "../narrative/interpolation";
import type { OperationArguments, OperationId, OperationTarget } from "./model";
import type { OperationPlacement } from "./targetAdapter";
import { OPERATION_TARGET_ADAPTERS } from "./targetCatalog";

export type OperationRequest = {
  target: OperationTarget;
  operation: OperationId;
  arguments?: OperationArguments;
  placement?: OperationPlacement;
};

export type OperationResult = {
  eventKey: string;
  attempt: number;
  accepted: boolean;
  responseText: string;
  effects: Effect[];
  state: PlayState;
  hookId: string | null;
};

export type OperationProvenance = {
  operation: OperationId;
  targetLabel: string;
};

export type OperationExecution = Omit<OperationResult, "effects"> & {
  events: EffectEvent[];
  provenance: OperationProvenance;
  source?: AuthoredSourceIdentity;
};

function resolveTarget(snapshot: ProjectSnapshot, state: PlayState, target: OperationTarget) {
  return OPERATION_TARGET_ADAPTERS[target.kind]?.resolve(snapshot, state, target) ?? null;
}

export function operationEventKey(target: OperationTarget, operation: OperationId) {
  return `${target.kind}:${target.id}:${operation}`;
}

function operationTargetLabel(snapshot: ProjectSnapshot, state: PlayState, target: OperationTarget) {
  return resolveTarget(snapshot, state, target)?.label ?? target.id;
}

function operationRuntimeBindings(state: PlayState, target: OperationTarget, args: OperationArguments | undefined) {
  const bindings: Record<string, string> = {
    [PLAYER_INPUT_BINDING]: state.lastCommand,
    [OPERATION_TARGET_KIND_BINDING]: target.kind,
    [OPERATION_TARGET_ID_BINDING]: target.id,
  };
  for (const [name, argument] of Object.entries(args ?? {})) {
    bindings[`${OPERATION_ARGUMENT_BINDING_PREFIX}${name}`] = argument.kind === "text" ? argument.value : argument.label;
  }
  return bindings;
}

function sourceForOperation(
  source: AuthoredSourceIdentity | undefined,
  operation: OperationId,
  hookId: string | null,
): AuthoredSourceIdentity | undefined {
  if (!source) return undefined;
  return {
    ...source,
    focus: {
      ...source.focus,
      section: "operations",
      operation,
      preferredOperation: operation,
      ...(hookId ? { hookId } : {}),
    },
  };
}

export function formatOperationOutput(execution: OperationExecution, previousState: PlayState) {
  const transitioned = execution.state.traversal.length > previousState.traversal.length;
  if (!execution.responseText && !transitioned) return "";
  const prefix = `[${execution.provenance.operation.toUpperCase()} > ${execution.provenance.targetLabel}]`;
  return execution.responseText ? `${prefix} ${execution.responseText}` : prefix;
}

/**
 * Single runtime path for every attempted operation.
 *
 * Generic operation semantics live here: attempts, authored hook selection,
 * conditions and effects. Feature adapters own target resolution plus any
 * target-specific default or successful-hook mutation. Adding a target kind
 * therefore does not add another central runtime branch.
 */
export function attemptOperation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  request: OperationRequest,
): OperationResult {
  const eventKey = operationEventKey(request.target, request.operation);
  const attempt = (state.attempts[eventKey] ?? 0) + 1;
  let nextState: PlayState = { ...state, attempts: { ...state.attempts, [eventKey]: attempt } };
  const adapter = OPERATION_TARGET_ADAPTERS[request.target.kind];
  const target = adapter?.resolve(snapshot, state, request.target) ?? null;

  if (!adapter || !target || !target.interactable || !target.operations.includes(request.operation)) {
    return { eventKey, attempt, accepted: false, responseText: "", effects: [], state: nextState, hookId: null };
  }

  const hook = [...target.hooks]
    .filter((candidate) => candidate.operation === request.operation)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .find((candidate) => evaluateCondition(candidate.condition, { snapshot, state: nextState, eventKey }));

  if (hook) {
    let accepted = hook.success;
    if (hook.success && adapter.applySuccessfulHook) {
      const targetResult = adapter.applySuccessfulHook({
        snapshot,
        state: nextState,
        target: request.target,
        operation: request.operation,
        arguments: request.arguments,
        placement: request.placement,
      });
      accepted = targetResult.accepted;
      nextState = targetResult.state;
    }
    return { eventKey, attempt, accepted, responseText: hook.responseText, effects: hook.effects, state: nextState, hookId: hook.id };
  }

  const fallback = adapter.defaultOperation?.({
    snapshot,
    state: nextState,
    target: request.target,
    operation: request.operation,
    arguments: request.arguments,
    placement: request.placement,
  });
  if (!fallback) {
    return { eventKey, attempt, accepted: false, responseText: "", effects: [], state: nextState, hookId: null };
  }
  return {
    eventKey,
    attempt,
    accepted: fallback.accepted,
    responseText: fallback.responseText ?? "",
    effects: [],
    state: fallback.state,
    hookId: null,
  };
}

export function executeOperation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  request: OperationRequest,
  now = Date.now(),
): OperationExecution {
  const target = resolveTarget(snapshot, state, request.target);
  const provenance = {
    operation: request.operation,
    targetLabel: operationTargetLabel(snapshot, state, request.target),
  };
  const attempt = attemptOperation(snapshot, state, request);
  const source = sourceForOperation(target?.authorSource, request.operation, attempt.hookId);
  const execution = executeEffects(snapshot, attempt.state, attempt.effects, {
    bindings: operationRuntimeBindings(state, request.target, request.arguments),
  });
  const context = { snapshot, state: execution.state, now };
  return {
    eventKey: attempt.eventKey,
    attempt: attempt.attempt,
    accepted: attempt.accepted,
    responseText: interpolateText(attempt.responseText, context),
    hookId: attempt.hookId,
    provenance,
    source,
    state: execution.state,
    events: execution.events.map((event) => {
      const next = event.type === "notification" || event.type === "transcript"
        ? { ...event, text: interpolateText(event.text, context) }
        : event;
      return source ? { ...next, source } : next;
    }),
  };
}
