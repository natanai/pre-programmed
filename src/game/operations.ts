import { evaluateCondition } from "./conditions";
import { executeEffects, type EffectEvent } from "./effects";
import { canPlaceItem } from "./inventory";
import { interpolateText } from "./interpolation";
import type {
  Effect,
  InventoryOperation,
  OperationHook,
  OperationTarget,
  PlayState,
  ProjectSnapshot,
} from "./model";

export type OperationRequest = {
  target: OperationTarget;
  operation: InventoryOperation;
  placement?: { x: number; y: number };
};

export type OperationResult = {
  eventKey: string;
  attempt: number;
  accepted: boolean;
  responseText: string;
  effects: Effect[];
  state: PlayState;
};

export type OperationProvenance = {
  operation: InventoryOperation;
  targetLabel: string;
};

export type OperationExecution = Omit<OperationResult, "effects"> & {
  events: EffectEvent[];
  provenance: OperationProvenance;
};

type ResolvedTarget = {
  definitionId: string;
  interactable: boolean;
  operations: InventoryOperation[];
  hooks: OperationHook[];
};

const ITEM_DEFAULT_OPERATIONS: InventoryOperation[] = ["inspect", "use", "move", "remove"];

function resolveTarget(snapshot: ProjectSnapshot, state: PlayState, target: OperationTarget): ResolvedTarget | null {
  if (target.kind === "item") {
    const entry = state.inventory.find((candidate) => candidate.instanceId === target.id);
    const definition = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
    if (!entry || !definition) return null;
    return {
      definitionId: definition.id,
      interactable: definition.interactable ?? true,
      operations: definition.operations ?? ITEM_DEFAULT_OPERATIONS,
      hooks: definition.hooks ?? [],
    };
  }
  const definitions = target.kind === "variable" ? snapshot.variables : snapshot.computedValues;
  const definition = definitions.find((candidate) => candidate.id === target.id);
  if (!definition) return null;
  return {
    definitionId: definition.id,
    interactable: definition.interactable ?? false,
    operations: definition.operations ?? [],
    hooks: definition.hooks ?? [],
  };
}

export function operationEventKey(target: OperationTarget, operation: InventoryOperation) {
  return `${target.kind}:${target.id}:${operation}`;
}

function operationTargetLabel(snapshot: ProjectSnapshot, state: PlayState, target: OperationTarget) {
  if (target.kind === "item") {
    const entry = state.inventory.find((candidate) => candidate.instanceId === target.id);
    const definition = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
    return definition?.name || definition?.key || target.id;
  }
  if (target.kind === "variable") {
    const definition = snapshot.variables.find((candidate) => candidate.id === target.id);
    return definition?.label || definition?.key || target.id;
  }
  const definition = snapshot.computedValues.find((candidate) => candidate.id === target.id);
  return definition?.label || definition?.key || target.id;
}

export function formatOperationOutput(execution: OperationExecution, previousState: PlayState) {
  const transitioned = execution.state.traversal.length > previousState.traversal.length;
  if (!execution.responseText && !transitioned) return "";
  const prefix = `[${execution.provenance.operation.toUpperCase()} > ${execution.provenance.targetLabel}]`;
  return execution.responseText ? `${prefix} ${execution.responseText}` : prefix;
}

/**
 * The single runtime path for every attempted inventory/status operation.
 * Target adapters resolve capabilities; only the physical-item adapter owns
 * placement/removal mutations. Variables and computed values remain read-only
 * unless an authored effect explicitly changes other play state.
 */
export function attemptOperation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  request: OperationRequest,
): OperationResult {
  const eventKey = operationEventKey(request.target, request.operation);
  const attempt = (state.attempts[eventKey] ?? 0) + 1;
  let nextState: PlayState = { ...state, attempts: { ...state.attempts, [eventKey]: attempt } };
  const target = resolveTarget(snapshot, state, request.target);
  if (!target || !target.interactable || !target.operations.includes(request.operation)) {
    return { eventKey, attempt, accepted: false, responseText: "", effects: [], state: nextState };
  }

  const hook = [...target.hooks]
    .filter((candidate) => candidate.operation === request.operation)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .find((candidate) => evaluateCondition(candidate.condition, { snapshot, state: nextState, eventKey }));

  if (hook) {
    let accepted = hook.success;
    if (hook.success && request.target.kind === "item") {
      const entry = nextState.inventory.find((candidate) => candidate.instanceId === request.target.id);
      const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
      if (!entry || !item) accepted = false;
      else if (request.operation === "move" && request.placement) {
        accepted = canPlaceItem(
          snapshot,
          nextState.inventory,
          item,
          request.placement.x,
          request.placement.y,
          entry.instanceId,
        );
        if (accepted) {
          nextState = {
            ...nextState,
            inventory: nextState.inventory.map((candidate) => candidate.instanceId === entry.instanceId
              ? { ...candidate, x: request.placement!.x, y: request.placement!.y }
              : candidate),
          };
        }
      } else if (request.operation === "remove") {
        nextState = { ...nextState, inventory: nextState.inventory.filter((candidate) => candidate.instanceId !== entry.instanceId) };
      }
    }
    return { eventKey, attempt, accepted, responseText: hook.responseText, effects: hook.effects, state: nextState };
  }

  if (request.target.kind !== "item") {
    return { eventKey, attempt, accepted: false, responseText: "", effects: [], state: nextState };
  }

  const entry = nextState.inventory.find((candidate) => candidate.instanceId === request.target.id);
  const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
  if (!entry || !item) return { eventKey, attempt, accepted: false, responseText: "", effects: [], state: nextState };
  if (request.operation === "inspect") {
    return { eventKey, attempt, accepted: true, responseText: item.description, effects: [], state: nextState };
  }
  if (request.operation === "move" && request.placement) {
    const accepted = canPlaceItem(snapshot, nextState.inventory, item, request.placement.x, request.placement.y, entry.instanceId);
    if (accepted) {
      nextState = {
        ...nextState,
        inventory: nextState.inventory.map((candidate) => candidate.instanceId === entry.instanceId
          ? { ...candidate, x: request.placement!.x, y: request.placement!.y }
          : candidate),
      };
    }
    return { eventKey, attempt, accepted, responseText: "", effects: [], state: nextState };
  }
  if (request.operation === "remove" && item.removable) {
    nextState = { ...nextState, inventory: nextState.inventory.filter((candidate) => candidate.instanceId !== entry.instanceId) };
    return { eventKey, attempt, accepted: true, responseText: "", effects: [], state: nextState };
  }
  return { eventKey, attempt, accepted: false, responseText: "", effects: [], state: nextState };
}

export function executeOperation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  request: OperationRequest,
  now = Date.now(),
): OperationExecution {
  const provenance = {
    operation: request.operation,
    targetLabel: operationTargetLabel(snapshot, state, request.target),
  };
  const attempt = attemptOperation(snapshot, state, request);
  const execution = executeEffects(snapshot, attempt.state, attempt.effects);
  const context = { snapshot, state: execution.state, now };
  return {
    eventKey: attempt.eventKey,
    attempt: attempt.attempt,
    accepted: attempt.accepted,
    responseText: interpolateText(attempt.responseText, context),
    provenance,
    state: execution.state,
    events: execution.events.map((event) => event.type === "notification"
      ? { ...event, text: interpolateText(event.text, context) }
      : event),
  };
}
