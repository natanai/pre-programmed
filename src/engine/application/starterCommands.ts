import { EQUIPMENT_STARTER_COMMANDS } from "../../features/equipment/defaultCommands";
import { INVENTORY_STARTER_COMMANDS } from "../../features/inventory/defaultCommands";
import { STATUS_STARTER_COMMANDS } from "../../features/status/defaultCommands";
import type { CommandDefinition } from "../../features/commands/model";

export const APPLICATION_STARTER_COMMANDS: readonly CommandDefinition[] = [
  ...INVENTORY_STARTER_COMMANDS,
  ...EQUIPMENT_STARTER_COMMANDS,
  ...STATUS_STARTER_COMMANDS,
];
