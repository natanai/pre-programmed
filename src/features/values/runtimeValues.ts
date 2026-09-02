import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { Value } from "../../engine/rules/model";
import { derivedValueProvider } from "../../engine/values/catalog";
import type { DerivedValueDefinition } from "./model";

export function readDerivedValue(
  definition: DerivedValueDefinition,
  snapshot: ProjectSnapshot,
  state: PlayState,
  now = Date.now(),
): Value {
  const provider = derivedValueProvider(definition.source.provider);
  return provider?.read(definition.source.metric, snapshot, state, now) ?? null;
}

export function readNamedValue(key: string, snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): Value {
  if (Object.prototype.hasOwnProperty.call(state.values, key)) return state.values[key];
  const derived = snapshot.derivedValueDefinitions.find((definition) => definition.key === key);
  return derived ? readDerivedValue(derived, snapshot, state, now) : null;
}
