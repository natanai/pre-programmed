import type { Effect } from "../../src/engine/rules/model";
import type { ProjectSnapshot } from "../../src/engine/project/model";
import type { OperationHook } from "../../src/features/operations/model";

type Issue = { key: string; message: string };

function inspectEffects(effects: Effect[], path: string, bodyIds: ReadonlySet<string>, issues: Issue[]) {
  for (const effect of effects) {
    if (effect.type === "set_body_type" && effect.bodyTypeId && !bodyIds.has(effect.bodyTypeId)) {
      issues.push({
        key: `${path}:${effect.id}:${effect.bodyTypeId}`,
        message: "A body-type effect references a body type that has not been saved.",
      });
    }
  }
}

function inspectHooks(hooks: OperationHook[], path: string, bodyIds: ReadonlySet<string>, issues: Issue[]) {
  for (const hook of hooks) inspectEffects(hook.effects, `${path}.hook.${hook.id}`, bodyIds, issues);
}

function issues(snapshot: ProjectSnapshot) {
  const found: Issue[] = [];
  const bodyIds = new Set(snapshot.bodyTypes.map((body) => body.id));
  const itemIds = new Set(snapshot.items.map((item) => item.id));

  for (const body of snapshot.bodyTypes) {
    for (const assignment of body.startingEquipment) {
      if (!itemIds.has(assignment.itemId)) {
        found.push({ key: `body.${body.id}.item.${assignment.itemId}`, message: "Starting equipment references an item that has not been saved." });
      }
      if (!body.slots.some((slot) => slot.key === assignment.slotKey)) {
        found.push({ key: `body.${body.id}.slot.${assignment.slotKey}`, message: "Starting equipment references a slot that does not exist on that body type." });
      }
    }
  }

  for (const rule of snapshot.equipmentRules) {
    if (!itemIds.has(rule.itemId)) found.push({ key: `rule.${rule.itemId}`, message: "An equipment rule references an item that has not been saved." });
  }

  for (const interaction of snapshot.interactions) {
    for (const outcome of interaction.outcomes) inspectEffects(outcome.effects, `interaction.${interaction.id}.${outcome.id}`, bodyIds, found);
  }
  for (const item of snapshot.items) inspectHooks(item.hooks ?? [], `item.${item.id}`, bodyIds, found);
  for (const entity of snapshot.entities) inspectHooks(entity.hooks ?? [], `entity.${entity.id}`, bodyIds, found);
  for (const value of [...snapshot.valueDefinitions, ...snapshot.derivedValueDefinitions]) inspectHooks(value.hooks ?? [], `value.${value.id}`, bodyIds, found);

  return found;
}

export function validateNewEquipmentReferences(before: ProjectSnapshot, after: ProjectSnapshot) {
  const existing = new Set(issues(before).map((issue) => issue.key));
  return issues(after).find((issue) => !existing.has(issue.key))?.message ?? null;
}
