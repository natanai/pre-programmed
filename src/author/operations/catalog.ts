import type { ProjectSnapshot } from "../../engine/project/model";
import type { AuthorOperationDefinition } from "../../features/operations/targetAdapter";
import { getAuthorOperationDefinitions } from "../features/registry";

/**
 * Compose module-provided operation capabilities with project-authored,
 * targeted command operation IDs. Targetless application commands and
 * commands aimed at another semantic target never leak into this catalog.
 * The hook editor therefore needs neither a central verb list nor UI-level
 * exclusions for particular commands.
 */
export function authorOperationDefinitions(
  snapshot: ProjectSnapshot,
  targetKind: string,
): readonly AuthorOperationDefinition[] {
  const authoredCommandDefinitions = snapshot.settings.commands.commands.flatMap((command) => {
    if (!command.targetSlot) return [];
    const targetSlot = command.slots.find((slot) => slot.name === command.targetSlot);
    if (!targetSlot || targetSlot.sourceKind !== targetKind) return [];
    return [{
      value: command.operation,
      label: command.label || command.operation,
      targetKinds: [targetSlot.sourceKind],
    } satisfies AuthorOperationDefinition];
  });
  const definitions: AuthorOperationDefinition[] = [
    ...getAuthorOperationDefinitions().filter((definition) => definition.targetKinds.includes(targetKind)),
    ...authoredCommandDefinitions,
  ];
  const seen = new Set<string>();
  return definitions.filter((definition) => {
    if (!definition.value || seen.has(definition.value)) return false;
    seen.add(definition.value);
    return true;
  });
}
