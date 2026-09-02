import { EQUIPMENT_APPLICATION_COMMAND_CAPABILITIES } from "../../features/equipment/applicationCommand";
import { INVENTORY_APPLICATION_COMMAND_CAPABILITIES } from "../../features/inventory/applicationCommand";
import { STATUS_APPLICATION_COMMAND_CAPABILITIES } from "../../features/status/applicationCommand";
import type { ApplicationCommandCapability } from "./capability";

export const APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [
  ...INVENTORY_APPLICATION_COMMAND_CAPABILITIES,
  ...EQUIPMENT_APPLICATION_COMMAND_CAPABILITIES,
  ...STATUS_APPLICATION_COMMAND_CAPABILITIES,
];
export const APPLICATION_COMMAND_CAPABILITY_BY_OPERATION: Readonly<Record<string, ApplicationCommandCapability>> = Object.fromEntries(APPLICATION_COMMAND_CAPABILITIES.map((capability) => [capability.operation, capability]));
