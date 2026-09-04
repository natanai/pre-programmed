import { INVENTORY_APPLICATION_COMMAND_CAPABILITIES } from "../../features/inventory/applicationCommand";
import { SESSION_APPLICATION_COMMAND_CAPABILITIES } from "../../features/session/applicationCommand";
import { STATE_APPLICATION_COMMAND_CAPABILITIES } from "../../features/state/applicationCommand";
import type { ApplicationCommandCapability } from "./capability";

/**
 * Explicit composition root for targetless application capabilities.
 *
 * Features contribute stable operation IDs here. Editable project command
 * grammar decides which player-facing words expose those capabilities.
 */
export const APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [
  ...INVENTORY_APPLICATION_COMMAND_CAPABILITIES,
  ...STATE_APPLICATION_COMMAND_CAPABILITIES,
  ...SESSION_APPLICATION_COMMAND_CAPABILITIES,
];

export const APPLICATION_COMMAND_CAPABILITY_BY_OPERATION: Readonly<Record<string, ApplicationCommandCapability>> =
  Object.fromEntries(APPLICATION_COMMAND_CAPABILITIES.map((capability) => [capability.operation, capability]));
