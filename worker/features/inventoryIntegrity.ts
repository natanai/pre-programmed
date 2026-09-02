import type { Condition, Effect } from "../../src/engine/rules/model";
import type { ProjectSnapshot } from "../../src/engine/project/model";
import type { OperationHook } from "../../src/features/operations/model";

type IntegrityIssue = {
  key: string;
  message: string;
};

function inspectCondition(
  condition: Condition,
  path: string,
  itemIds: ReadonlySet<string>,
  issues: IntegrityIssue[],
) {
  if (condition.type === "all" || condition.type === "any") {
    condition.conditions.forEach((child, index) => inspectCondition(child, `${path}.${index}`, itemIds, issues));
    return;
  }
  if (condition.type === "not") {
    inspectCondition(condition.condition, `${path}.not`, itemIds, issues);
    return;
  }
  if ((condition.type === "has_item" || condition.type === "lacks_item") && !itemIds.has(condition.itemId)) {
    issues.push({
      key: `${path}:item:${condition.itemId}`,
      message: "An item condition references an item that has not been saved. Save or create the item before saving this rule.",
    });
  }
}

function inspectEffects(
  effects: Effect[],
  path: string,
  itemIds: ReadonlySet<string>,
  bodyTypeIds: ReadonlySet<string>,
  issues: IntegrityIssue[],
) {
  for (const effect of effects) {
    const effectPath = `${path}.effect.${effect.id}`;
    if (
      (effect.type === "give_item" || effect.type === "remove_item" || effect.type === "set_item_state")
      && !itemIds.has(effect.itemId)
    ) {
      issues.push({
        key: `${effectPath}:item:${effect.itemId}`,
        message: "An item effect references an item that has not been saved. Save or create the item before saving this effect.",
      });
    }
    if (effect.type === "set_body_background" && !bodyTypeIds.has(effect.backgroundId)) {
      issues.push({
        key: `${effectPath}:body-type:${effect.backgroundId}`,
        message: "A body-type effect references a body type that has not been saved. Save or create it before saving this effect.",
      });
    }
  }
}

function inspectHooks(
  hooks: OperationHook[],
  path: string,
  itemIds: ReadonlySet<string>,
  bodyTypeIds: ReadonlySet<string>,
  issues: IntegrityIssue[],
) {
  for (const hook of hooks) {
    const hookPath = `${path}.hook.${hook.id}`;
    inspectCondition(hook.condition, `${hookPath}.condition`, itemIds, issues);
    inspectEffects(hook.effects, hookPath, itemIds, bodyTypeIds, issues);
  }
}

export function inventoryReferenceIssues(snapshot: ProjectSnapshot) {
  const issues: IntegrityIssue[] = [];
  const itemIds = new Set(snapshot.items.map((item) => item.id));
  const bodyTypeIds = new Set((snapshot.bodyBackgrounds ?? []).map((bodyType) => bodyType.id));

  for (const interaction of snapshot.interactions) {
    for (const outcome of interaction.outcomes) {
      const path = `interaction.${interaction.id}.outcome.${outcome.id}`;
      inspectCondition(outcome.condition, `${path}.condition`, itemIds, issues);
      inspectEffects(outcome.effects, path, itemIds, bodyTypeIds, issues);
    }
  }

  for (const item of snapshot.items) {
    inspectHooks(item.hooks ?? [], `item.${item.id}`, itemIds, bodyTypeIds, issues);
  }
  for (const entity of snapshot.entities) {
    inspectHooks(entity.hooks ?? [], `entity.${entity.id}`, itemIds, bodyTypeIds, issues);
  }
  for (const variable of snapshot.variables) {
    inspectHooks(variable.hooks ?? [], `variable.${variable.id}`, itemIds, bodyTypeIds, issues);
  }
  for (const computed of snapshot.computedValues) {
    inspectHooks(computed.hooks ?? [], `computed.${computed.id}`, itemIds, bodyTypeIds, issues);
  }

  return issues;
}

/**
 * Existing legacy damage must not freeze all authoring. Reject only dangling
 * Inventory references introduced by this mutation; a later item upsert can
 * still repair a reference that is already present in the hosted project.
 */
export function validateNewInventoryReferences(before: ProjectSnapshot, after: ProjectSnapshot) {
  const existing = new Set(inventoryReferenceIssues(before).map((issue) => issue.key));
  return inventoryReferenceIssues(after).find((issue) => !existing.has(issue.key))?.message ?? null;
}
