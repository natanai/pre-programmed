import type { ProjectReferenceContribution, ResourceReference } from "../../../author/references/types";

function hookTargets(context: Parameters<ProjectReferenceContribution>[1], hooks: readonly { condition: Parameters<typeof context.condition>[0]; effects: Parameters<typeof context.effects>[0] }[]): ResourceReference[] {
  return hooks.flatMap((hook) => [...context.condition(hook.condition), ...context.effects(hook.effects)]);
}

export const inventoryProjectReferences: ProjectReferenceContribution = (snapshot, context) => snapshot.items.flatMap((item) => hookTargets(context, item.hooks ?? []).map((target) => ({
  ...target, ownerKind: "item", ownerId: item.id, ownerLabel: item.name || item.key,
  route: { type: "feature" as const, feature: "inventory", workspace: "item", data: { itemId: item.id } },
})));
