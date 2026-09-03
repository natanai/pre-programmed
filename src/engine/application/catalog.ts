import { INVENTORY_APPLICATION_COMMAND_CAPABILITIES } from "../../features/inventory/applicationCommand";
import { STATE_APPLICATION_COMMAND_CAPABILITIES } from "../../features/state/applicationCommand";
import type { ApplicationCommandCapability } from "./capability";

/**
 * Explicit composition root for targetless application capabilities.
 *
 * Features contribute stable operation IDs here. Authored project grammar
 * decides which player-facing words, if any, expose those capabilities.
 */
export const APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [
  ...INVENTORY_APPLICATION_COMMAND_CAPABILITIES,
  ...STATE_APPLICATION_COMMAND_CAPABILITIES,
];

export const APPLICATION_COMMAND_CAPABILITY_BY_OPERATION: Readonly<Record<string, ApplicationCommandCapability>> =
  Object.fromEntries(APPLICATION_COMMAND_CAPABILITIES.map((capability) => [capability.operation, capability]));
