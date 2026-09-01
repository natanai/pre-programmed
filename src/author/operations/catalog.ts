import type { ProjectSnapshot } from "../../engine/project/model";
import type { AuthorOperationDefinition } from "../../features/operations/targetAdapter";

export function authorOperationDefinitions(snapshot: ProjectSnapshot): readonly AuthorOperationDefinition[] {
  const definitions: AuthorOperationDefinition[] = [
    ...snapshot.settings.commands.commands.map((command) => ({
      value: command.operation,
      label: command.label || command.operation,
    })),
  ];
  const seen = new Set<string>();
  return definitions.filter((definition) => {
    if (!definition.value || seen.has(definition.value)) return false;
    seen.add(definition.value);
    return true;
  });
}
