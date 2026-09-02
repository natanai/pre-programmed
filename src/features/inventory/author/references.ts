import type { ProjectReferenceContribution, ResourceReference } from "../../../author/references/types";

function fromTargets(
  targets: readonly ResourceReference[],
  owner: Omit<ReturnType<ProjectReferenceContribution>[number], "resourceKind" | "resourceId" | "detail">,
) {
  return targets.map((target) => ({ ...owner, ...target }));
}

export const inventoryProjectReferences: ProjectReferenceContribution = (snapshot, context) => [
  ...snapshot.items.flatMap((item) => {
    const owner = {
      ownerKind: "item",
      ownerId: item.id,
      ownerLabel: item.name || item.key || "Untitled item",
      route: { type: "feature" as const, feature: "inventory", workspace: "item", data: { itemId: item.id } },
    };
    return [
      ...(item.assetId ? [{ ...owner, resourceKind: "media-image", resourceId: item.assetId, detail: "item image" }] : []),
      ...item.hooks.flatMap((hook) => [
        ...fromTargets(context.condition(hook.condition), owner),
        ...fromTargets(context.effects(hook.effects), owner),
      ]),
    ];
  }),
  ...(snapshot.bodyBackgrounds ?? []).flatMap((bodyType) => {
    const owner = {
      ownerKind: "body-type",
      ownerId: bodyType.id,
      ownerLabel: bodyType.name || "Untitled body type",
      route: { type: "feature" as const, feature: "inventory", workspace: "body-type", data: { bodyTypeId: bodyType.id } },
    };
    return [
      ...(bodyType.assetId ? [{ ...owner, resourceKind: "media-image", resourceId: bodyType.assetId, detail: "body image" }] : []),
      ...(bodyType.startingEquipment ?? []).map((entry) => ({
        ...owner,
        resourceKind: "item",
        resourceId: entry.itemId,
        detail: `starting equipment in ${entry.slotKey}`,
      })),
    ];
  }),
];
