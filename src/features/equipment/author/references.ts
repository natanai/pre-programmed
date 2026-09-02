import type { ProjectReferenceContribution } from "../../../author/references/types";

export const equipmentProjectReferences: ProjectReferenceContribution = (snapshot) => [
  ...snapshot.bodyTypes.flatMap((bodyType) => bodyType.startingEquipment.map((assignment) => ({
    resourceKind: "item", resourceId: assignment.itemId, detail: `starting equipment in ${assignment.slotKey}`,
    ownerKind: "body-type", ownerId: bodyType.id, ownerLabel: bodyType.name,
    route: { type: "feature" as const, feature: "equipment", workspace: "body-type", data: { bodyTypeId: bodyType.id } },
  }))),
  ...snapshot.equipmentRules.map((rule) => ({
    resourceKind: "item", resourceId: rule.itemId, detail: "equipment rule",
    ownerKind: "equipment-rule", ownerId: rule.itemId, ownerLabel: snapshot.items.find((item) => item.id === rule.itemId)?.name || "Equipment rule",
    route: { type: "feature" as const, feature: "equipment", workspace: "rule", data: { itemId: rule.itemId } },
  })),
];
