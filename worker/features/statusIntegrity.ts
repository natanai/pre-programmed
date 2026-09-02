import type { ProjectSnapshot } from "../../src/engine/project/model";

export function validateNewStatusReferences(previous: ProjectSnapshot, projected: ProjectSnapshot) {
  const previousIssues = new Set(previous.statusEntries.filter((entry) => {
    const source = entry.source.kind === "value" ? previous.valueDefinitions : previous.derivedValueDefinitions;
    return !source.some((definition) => definition.id === entry.source.id);
  }).map((entry) => entry.id));

  const groupIds = new Set(projected.statusGroups.map((group) => group.id));
  for (const entry of projected.statusEntries) {
    if (!groupIds.has(entry.groupId) && !previousIssues.has(entry.id)) return "A status entry references a group that has not been saved.";
    const source = entry.source.kind === "value" ? projected.valueDefinitions : projected.derivedValueDefinitions;
    if (!source.some((definition) => definition.id === entry.source.id) && !previousIssues.has(entry.id)) return "A status entry references a value that has not been saved.";
  }
  return null;
}
