import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { evaluateCondition } from "../../engine/rules/conditions";
import type { Value } from "../../engine/rules/model";
import { readDerivedValue } from "../values/runtimeValues";
import type { StatusEntryDefinition, StatusGroupDefinition } from "./model";

export function statusEntryValue(entry: StatusEntryDefinition, snapshot: ProjectSnapshot, state: PlayState): Value {
  if (entry.source.kind === "value") {
    const definition = snapshot.valueDefinitions.find((candidate) => candidate.id === entry.source.id);
    return definition ? state.values[definition.key] ?? definition.initialValue : null;
  }
  const definition = snapshot.derivedValueDefinitions.find((candidate) => candidate.id === entry.source.id);
  return definition ? readDerivedValue(definition, snapshot, state) : null;
}

export function visibleStatusEntries(group: StatusGroupDefinition, snapshot: ProjectSnapshot, state: PlayState) {
  const context = { snapshot, state };
  if (!evaluateCondition(group.visibleWhen, context)) return [];
  return snapshot.statusEntries
    .filter((entry) => entry.groupId === group.id && evaluateCondition(entry.visibleWhen, context))
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

export function visibleStatusGroups(snapshot: ProjectSnapshot, state: PlayState) {
  return snapshot.statusGroups
    .map((group) => ({ group, entries: visibleStatusEntries(group, snapshot, state) }))
    .filter((item) => item.entries.length > 0)
    .sort((left, right) => left.group.order - right.group.order || left.group.id.localeCompare(right.group.id));
}
