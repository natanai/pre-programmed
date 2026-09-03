import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { evaluateCondition } from "../../engine/rules/conditions";
import type { Value } from "../../engine/rules/model";
import type { ComputedDefinition, StateGroupDefinition, VariableDefinition } from "./model";
import { readComputedValue } from "./runtimeValues";

export type VisibleStateEntry =
  | { kind: "variable"; definition: VariableDefinition; value: Value; order: number }
  | { kind: "computed"; definition: ComputedDefinition; value: Value; order: number };

export type VisibleStateGroup = {
  group: StateGroupDefinition;
  entries: VisibleStateEntry[];
};

function visibleInGroup(
  groupId: string,
  definition: VariableDefinition | ComputedDefinition,
  snapshot: ProjectSnapshot,
  state: PlayState,
) {
  const presentation = definition.playerPresentation;
  return Boolean(
    presentation?.groupId === groupId
    && evaluateCondition(presentation.visibleWhen, { snapshot, state }),
  );
}

export function visibleStateEntries(
  group: StateGroupDefinition,
  snapshot: ProjectSnapshot,
  state: PlayState,
  now = Date.now(),
): VisibleStateEntry[] {
  if (!evaluateCondition(group.visibleWhen, { snapshot, state })) return [];
  const variables: VisibleStateEntry[] = snapshot.variables
    .filter((definition) => visibleInGroup(group.id, definition, snapshot, state))
    .map((definition) => ({
      kind: "variable" as const,
      definition,
      value: state.values[definition.key] ?? definition.initialValue,
      order: definition.playerPresentation?.order ?? 0,
    }));
  const computed: VisibleStateEntry[] = snapshot.computedValues
    .filter((definition) => visibleInGroup(group.id, definition, snapshot, state))
    .map((definition) => ({
      kind: "computed" as const,
      definition,
      value: readComputedValue(definition, snapshot, state, now),
      order: definition.playerPresentation?.order ?? 0,
    }));
  return [...variables, ...computed].sort((left, right) =>
    left.order - right.order
    || left.definition.label.localeCompare(right.definition.label)
    || left.definition.id.localeCompare(right.definition.id));
}

export function visibleStateGroups(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): VisibleStateGroup[] {
  return snapshot.stateGroups
    .map((group) => ({ group, entries: visibleStateEntries(group, snapshot, state, now) }))
    .filter(({ entries }) => entries.length > 0)
    .sort((left, right) => left.group.order - right.group.order || left.group.label.localeCompare(right.group.label));
}
