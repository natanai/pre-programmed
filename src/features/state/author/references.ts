import type { ProjectReferenceContribution, ResourceReference } from "../../../author/references/types";

function hookTargets(
  context: Parameters<ProjectReferenceContribution>[1],
  hooks: readonly { condition: Parameters<typeof context.condition>[0]; effects: Parameters<typeof context.effects>[0] }[],
): ResourceReference[] {
  return hooks.flatMap((hook) => [...context.condition(hook.condition), ...context.effects(hook.effects)]);
}

export const stateProjectReferences: ProjectReferenceContribution = (snapshot, context) => [
  ...snapshot.entities.flatMap((entity) => hookTargets(context, entity.hooks ?? []).map((target) => ({
    ...target,
    ownerKind: entity.type,
    ownerId: entity.id,
    ownerLabel: entity.name || entity.key,
    route: { type: "feature" as const, feature: "state", workspace: "definitions", data: { resourceKind: entity.type, resourceId: entity.id } },
  }))),
  ...[...snapshot.variables, ...snapshot.computedValues].flatMap((definition) => hookTargets(context, definition.hooks).map((target) => ({
    ...target,
    ownerKind: "state",
    ownerId: definition.id,
    ownerLabel: definition.label || definition.key,
    route: { type: "feature" as const, feature: "state", workspace: "definitions", data: { resourceId: definition.id } },
  }))),
];
