import type { ProjectReference, ProjectReferenceContribution, ResourceReference } from "../../../author/references/types";

function hookTargets(
  context: Parameters<ProjectReferenceContribution>[1],
  hooks: readonly { condition: Parameters<typeof context.condition>[0]; effects: Parameters<typeof context.effects>[0] }[],
): ResourceReference[] {
  return hooks.flatMap((hook) => [...context.condition(hook.condition), ...context.effects(hook.effects)]);
}

export const worldProjectReferences: ProjectReferenceContribution = (snapshot, context) => snapshot.entities.flatMap((entity): ProjectReference[] => {
  const route = { type: "feature" as const, feature: "world", workspace: "entity", data: { entityType: entity.type, resourceId: entity.id } };
  const references: ProjectReference[] = hookTargets(context, entity.hooks ?? []).map((target) => ({
    ...target,
    ownerKind: entity.type,
    ownerId: entity.id,
    ownerLabel: entity.name || entity.key,
    route,
  }));

  if (entity.type === "character" && entity.portraitAssetId) {
    references.push({
      resourceKind: "media-image",
      resourceId: entity.portraitAssetId,
      detail: "character portrait",
      ownerKind: entity.type,
      ownerId: entity.id,
      ownerLabel: entity.name || entity.key,
      route,
    });
  }

  return references;
});
