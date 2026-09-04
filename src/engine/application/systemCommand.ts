import { normalizePlayerInput } from "../input/normalize";
import { APPLICATION_COMMAND_CAPABILITIES } from "./catalog";
import type { ApplicationCommandCapability } from "./capability";

export type SystemApplicationCommandMatch = {
  capability: ApplicationCommandCapability;
  pattern: string;
};

/**
 * Resolve installation-level application commands without teaching the command
 * feature which application capabilities are installed in this build.
 */
export function matchSystemApplicationCommands(input: string): SystemApplicationCommandMatch[] {
  const normalized = normalizePlayerInput(input);
  return APPLICATION_COMMAND_CAPABILITIES.flatMap((capability) =>
    (capability.systemPatterns ?? []).flatMap((pattern) =>
      normalizePlayerInput(pattern) === normalized ? [{ capability, pattern }] : []),
  ).sort((left, right) =>
    right.pattern.length - left.pattern.length
    || left.capability.operation.localeCompare(right.capability.operation));
}
