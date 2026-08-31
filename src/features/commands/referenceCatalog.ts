import { INVENTORY_COMMAND_REFERENCE_SOURCES } from "../inventory/commandReferences";
import { STATE_COMMAND_REFERENCE_SOURCES } from "../state/commandReferences";
import { WORLD_COMMAND_REFERENCE_SOURCES } from "../world/commandReferences";
import type { CommandReferenceSource } from "./referenceSource";

/**
 * Explicit static composition of terminal-reference providers.
 *
 * The Commands parser consumes only this generic catalog. Feature modules own
 * the vocabulary candidates for their own data. Adding a new target domain
 * therefore adds a provider here rather than another parser switch case.
 */
export const COMMAND_REFERENCE_SOURCES: readonly CommandReferenceSource[] = [
  ...WORLD_COMMAND_REFERENCE_SOURCES,
  ...INVENTORY_COMMAND_REFERENCE_SOURCES,
  ...STATE_COMMAND_REFERENCE_SOURCES,
];

export const COMMAND_REFERENCE_SOURCE_BY_KIND = Object.fromEntries(
  COMMAND_REFERENCE_SOURCES.map((source) => [source.kind, source]),
) as Record<string, CommandReferenceSource>;
