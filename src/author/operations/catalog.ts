import type { ProjectSnapshot } from "../../engine/project/model";
import type { AuthorOperationDefinition } from "../../features/operations/targetAdapter";
import { getAuthorOperationDefinitions } from "../features/registry";

/**
 * Compose module-provided operation capabilities with project-authored targeted
 * Player Command operation IDs. Commands that respond with text or open a
 * player application surface never leak into target operation authoring.
 */
export function authorOperationDefinitions(
  snapshot: ProjectSnapshot,
  targetKind: string,
): readonly AuthorOperationDefinition[] {
  const authoredCommandDefinitions = snapshot.settings.commands.commands.flatMap((command) => {
    const action = command.action;
    if (action.type !== "target-operation") return [];
    const targetSlot = command.slots.find((slot) => slot.name === action.targetSlot);
    if (!targetSlot || !targetSlot.sourceKinds.includes(targetKind)) return [];
    return [{
      value: action.operation,
      label: command.label || action.operation,
      targetKinds: [...targetSlot.sourceKinds],
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
