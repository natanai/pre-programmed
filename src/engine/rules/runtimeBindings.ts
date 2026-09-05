import type { Value } from "./primitives";

/**
 * Transient values supplied by the runtime that authored effects may consume.
 *
 * Bindings are execution context, not project data and not PlayState. Features
 * may contribute values to this envelope without importing the feature that
 * later consumes them.
 */
export type RuntimeBindings = Readonly<Record<string, Value>>;

export type RuleRuntimeContext = {
  bindings?: RuntimeBindings;
};

/**
 * Authored value input. Literal values remain literals; tagged bindings defer
 * resolution until the effect runs.
 *
 * Keeping literals as the primitive Value shape means existing authored data is
 * already canonical and needs no compatibility representation or migration.
 */
export type ValueSource = Value | {
  kind: "binding";
  key: string;
};

export const PLAYER_INPUT_BINDING = "input.raw";
export const OPERATION_ARGUMENT_BINDING_PREFIX = "argument.";

export function runtimeBinding(key: string): ValueSource {
  return { kind: "binding", key };
}

export function isRuntimeBinding(source: ValueSource): source is Extract<ValueSource, { kind: "binding" }> {
  return source !== null && typeof source === "object" && source.kind === "binding";
}

/** Missing bindings resolve to undefined; null remains a legitimate Value. */
export function resolveValueSource(source: ValueSource, context?: RuleRuntimeContext): Value | undefined {
  if (!isRuntimeBinding(source)) return source;
  if (!context?.bindings || !Object.prototype.hasOwnProperty.call(context.bindings, source.key)) return undefined;
  return context.bindings[source.key];
}
