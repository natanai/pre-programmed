import type { ProjectReferenceContribution, ResourceReference } from "../../../author/references/types";

function hookTargets(
  context: Parameters<ProjectReferenceContribution>[1],
  hooks: readonly { condition: Parameters<typeof context.condition>[0]; effects: Parameters<typeof context.effects>[0] }[],
): ResourceReference[] {
  return hooks.flatMap((hook) => [...context.condition(hook.condition), ...context.effects(hook.effects)]);
}

export const stateProjectReferences: ProjectReferenceContribution = (snapshot, context) => [
  ...snapshot.variables.flatMap((definition) => {
    const route = { type: "feature" as const, feature: "state", workspace: "definitions", data: { resourceKind: "variable", resourceId: definition.id } };
    const owner = { ownerKind: "variable", ownerId: definition.id, ownerLabel: definition.label || definition.key, route };
    return [
      ...hookTargets(context, definition.hooks).map((target) => ({ ...target, ...owner })),
      ...(definition.playerPresentation ? [
        { resourceKind: "state-group", resourceId: definition.playerPresentation.groupId, detail: "player presentation group", ...owner },
        ...context.condition(definition.playerPresentation.visibleWhen).map((target) => ({ ...target, ...owner })),
      ] : []),
    ];
  }),
  ...snapshot.computedValues.flatMap((definition) => {
    const route = { type: "feature" as const, feature: "state", workspace: "definitions", data: { resourceKind: "computed", resourceId: definition.id } };
    const owner = { ownerKind: "computed", ownerId: definition.id, ownerLabel: definition.label || definition.key, route };
    return [
      ...hookTargets(context, definition.hooks).map((target) => ({ ...target, ...owner })),
      ...(definition.playerPresentation ? [
        { resourceKind: "state-group", resourceId: definition.playerPresentation.groupId, detail: "player presentation group", ...owner },
        ...context.condition(definition.playerPresentation.visibleWhen).map((target) => ({ ...target, ...owner })),
      ] : []),
    ];
  }),
  ...snapshot.stateGroups.flatMap((group) => context.condition(group.visibleWhen).map((target) => ({
    ...target,
    ownerKind: "state-group",
    ownerId: group.id,
    ownerLabel: group.label,
    route: { type: "feature" as const, feature: "state", workspace: "definitions", data: { resourceKind: "state-group", resourceId: group.id } },
  }))),
];
