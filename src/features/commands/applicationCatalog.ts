import { INVENTORY_APPLICATION_COMMAND_CAPABILITIES } from "../inventory/applicationCommand";
import type { ApplicationCommandCapability } from "./applicationCapability";

/**
 * Explicit composition root for targetless application capabilities.
 * New modules contribute stable operation IDs here; authored project grammar
 * decides which player-facing words, if any, expose those capabilities.
 */
export const APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [
  ...INVENTORY_APPLICATION_COMMAND_CAPABILITIES,
];

export const APPLICATION_COMMAND_CAPABILITY_BY_OPERATION: Readonly<Record<string, ApplicationCommandCapability>> =
  Object.fromEntries(APPLICATION_COMMAND_CAPABILITIES.map((capability) => [capability.operation, capability]));
