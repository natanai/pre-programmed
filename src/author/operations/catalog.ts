import type { ProjectSnapshot } from "../../engine/project/model";
import { INVENTORY_OPERATION_DEFINITIONS } from "../../features/inventory/operationAdapter";
import type { AuthorOperationDefinition } from "../../features/operations/targetAdapter";

/**
 * Compose module-provided operation capabilities with project-authored command
 * operation IDs. The hook editor therefore never needs a central verb list:
 * defining a command operation makes that operation available to targets.
 */
export function authorOperationDefinitions(snapshot: ProjectSnapshot): readonly AuthorOperationDefinition[] {
  const definitions: AuthorOperationDefinition[] = [
    ...INVENTORY_OPERATION_DEFINITIONS,
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
