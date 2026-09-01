import type { ApplicationCommandCapability } from "./applicationCapability";

export const APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [];

export const APPLICATION_COMMAND_CAPABILITY_BY_OPERATION: Readonly<Record<string, ApplicationCommandCapability>> =
  Object.fromEntries(APPLICATION_COMMAND_CAPABILITIES.map((capability) => [capability.operation, capability]));
