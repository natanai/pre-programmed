import { STATE_COMMAND_REFERENCE_SOURCES } from "../state/commandReferences";
import { WORLD_COMMAND_REFERENCE_SOURCES } from "../world/commandReferences";
import type { CommandReferenceSource } from "./referenceSource";

export const COMMAND_REFERENCE_SOURCES: readonly CommandReferenceSource[] = [
  ...WORLD_COMMAND_REFERENCE_SOURCES,
  ...STATE_COMMAND_REFERENCE_SOURCES,
];

export const COMMAND_REFERENCE_SOURCE_BY_KIND = Object.fromEntries(
  COMMAND_REFERENCE_SOURCES.map((source) => [source.kind, source]),
) as Record<string, CommandReferenceSource>;
