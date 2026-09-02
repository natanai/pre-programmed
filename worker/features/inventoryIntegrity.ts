import type { Condition, Effect } from "../../src/engine/rules/model";
import type { ProjectSnapshot } from "../../src/engine/project/model";
import type { OperationHook } from "../../src/features/operations/model";

type IntegrityIssue = { key: string; message: string };

function inspectCondition(condition: Condition, path: string, itemIds: ReadonlySet<string>, issues: IntegrityIssue[]) {
  if (condition.type === "all" || condition.type === "any") {
    condition.conditions.forEach((child, index) => inspectCondition(child, `${path}.${index}`, itemIds, issues));
    return;
  }
  if (condition.type === "not") {
    inspectCondition(condition.condition, `${path}.not`, itemIds, issues);
    return;
  }
  if ((condition.type === "has_item" || condition.type === "lacks_item") && !itemIds.has(condition.itemId)) issues.push({ key: `${path}:item:${condition.itemId}`, message: "An item condition references an item that has not been saved." });
}

function inspectEffects(effects: Effect[], path: string, itemIds: ReadonlySet<string>, issues: IntegrityIssue[]) {
  for (const effect of effects) {
    if ((effect.type === "give_item" || effect.type === "remove_item" || effect.type === "set_item_state") && !itemIds.has(effect.itemId)) issues.push({ key: `${path}.effect.${effect.id}:item:${effect.itemId}`, message: "An item effect references an item that has not been saved." });
  }
}

function inspectHooks(hooks: OperationHook[], path: string, itemIds: ReadonlySet<string>, issues: IntegrityIssue[]) {
  for (const hook of hooks) {
    const hookPath = `${path}.hook.${hook.id}`;
    inspectCondition(hook.condition, `${hookPath}.condition`, itemIds, issues);
    inspectEffects(hook.effects, hookPath, itemIds, issues);
  }
}

export function inventoryReferenceIssues(snapshot: ProjectSnapshot) {
  const issues: IntegrityIssue[] = [];
  const itemIds = new Set(snapshot.items.map((item) => item.id));
  for (const interaction of snapshot.interactions) for (const outcome of interaction.outcomes) {
    const path = `interaction.${interaction.id}.outcome.${outcome.id}`;
    inspectCondition(outcome.condition, `${path}.condition`, itemIds, issues);
    inspectEffects(outcome.effects, path, itemIds, issues);
  }
  for (const item of snapshot.items) inspectHooks(item.hooks ?? [], `item.${item.id}`, itemIds, issues);
  for (const entity of snapshot.entities) inspectHooks(entity.hooks ?? [], `entity.${entity.id}`, itemIds, issues);
  for (const value of snapshot.valueDefinitions) inspectHooks(value.hooks ?? [], `value.${value.id}`, itemIds, issues);
  for (const value of snapshot.derivedValueDefinitions) inspectHooks(value.hooks ?? [], `derived.${value.id}`, itemIds, issues);
  for (const group of snapshot.statusGroups) inspectCondition(group.visibleWhen, `status-group.${group.id}`, itemIds, issues);
  for (const entry of snapshot.statusEntries) inspectCondition(entry.visibleWhen, `status-entry.${entry.id}`, itemIds, issues);
  return issues;
}

export function validateNewInventoryReferences(before: ProjectSnapshot, after: ProjectSnapshot) {
  const existing = new Set(inventoryReferenceIssues(before).map((issue) => issue.key));
  return inventoryReferenceIssues(after).find((issue) => !existing.has(issue.key))?.message ?? null;
}
