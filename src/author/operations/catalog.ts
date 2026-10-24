import type { ProjectSnapshot } from "../../engine/project/model";

/** Operations offered in target editors come only from authored Player Commands. */
export type AuthoredTargetOperation = {
  value: string;
  label: string;
  commandId: string;
};

export function authorOperationDefinitions(
  snapshot: ProjectSnapshot,
  targetKind: string,
): readonly AuthoredTargetOperation[] {
  const definitions = snapshot.settings.commands.commands.flatMap((command) => {
    const action = command.action;
    if (!command.enabled || action.type !== "target-operation") return [];
    const targetSlot = command.slots.find((slot) => slot.name === action.targetSlot);
    if (!targetSlot?.sourceKinds.includes(targetKind)) return [];
    return [{
      value: action.operation,
      label: command.label || action.operation,
      commandId: command.id,
    }];
  });
  const seen = new Set<string>();
  return definitions.filter((definition) => {
    if (!definition.value || seen.has(definition.value)) return false;
    seen.add(definition.value);
    return true;
  });
}
