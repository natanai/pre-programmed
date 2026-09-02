import type { CommandDefinition } from "../commands/model";

export const EQUIPMENT_STARTER_COMMANDS: readonly CommandDefinition[] = [{
  id: "starter-equipment-open",
  label: "Equipment",
  operation: "equipment.open",
  enabled: true,
  patterns: ["equipment"],
  slots: [],
  targetSlot: "",
}];
