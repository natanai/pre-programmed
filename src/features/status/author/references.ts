import type { ProjectReferenceContribution } from "../../../author/references/types";

export const statusProjectReferences: ProjectReferenceContribution = (snapshot, context) => [
  ...snapshot.statusGroups.flatMap((group) => context.condition(group.visibleWhen).map((target) => ({
    ...target,
    ownerKind: "status-group",
    ownerId: group.id,
    ownerLabel: group.label || group.key,
    route: { type: "feature" as const, feature: "status", workspace: "group", data: { groupId: group.id } },
  }))),
  ...snapshot.statusEntries.flatMap((entry) => context.condition(entry.visibleWhen).map((target) => ({
    ...target,
    ownerKind: "status-entry",
    ownerId: entry.id,
    ownerLabel: entry.label || "Status entry",
    route: { type: "feature" as const, feature: "status", workspace: "entry", data: { entryId: entry.id, groupId: entry.groupId } },
  }))),
];
