import type { ProjectReferenceContribution, ResourceReference } from "../../../author/references/types";

function hookTargets(context: Parameters<ProjectReferenceContribution>[1], hooks: readonly { condition: Parameters<typeof context.condition>[0]; effects: Parameters<typeof context.effects>[0] }[]): ResourceReference[] {
  return hooks.flatMap((hook) => [...context.condition(hook.condition), ...context.effects(hook.effects)]);
}

export const valuesProjectReferences: ProjectReferenceContribution = (snapshot, context) => [
  ...[...snapshot.valueDefinitions, ...snapshot.derivedValueDefinitions].flatMap((definition) => hookTargets(context, definition.hooks).map((target) => ({
    ...target,
    ownerKind: "value",
    ownerId: definition.id,
    ownerLabel: definition.label || definition.key,
    route: {
      type: "feature" as const,
      feature: "values",
      workspace: snapshot.valueDefinitions.some((candidate) => candidate.id === definition.id) ? "value" : "derived-value",
      data: { resourceId: definition.id },
    },
  }))),
];
