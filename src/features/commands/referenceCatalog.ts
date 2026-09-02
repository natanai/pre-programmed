import { INVENTORY_COMMAND_REFERENCE_SOURCES } from "../inventory/commandReferences";
import { VALUES_COMMAND_REFERENCE_SOURCES } from "../values/commandReferences";
import { WORLD_COMMAND_REFERENCE_SOURCES } from "../world/commandReferences";
import type { CommandReferenceSource } from "./referenceSource";

/**
 * Explicit static composition of terminal-reference providers.
 *
 * The Commands parser consumes only this generic catalog. Feature modules own
 * the vocabulary candidates for their own data. Adding a new target domain
 * therefore adds a provider here rather than another parser switch case.
 */
export function commandReferenceSources() {
  return [
    ...WORLD_COMMAND_REFERENCE_SOURCES,
    ...INVENTORY_COMMAND_REFERENCE_SOURCES,
    ...VALUES_COMMAND_REFERENCE_SOURCES,
  ] satisfies readonly CommandReferenceSource[];
}

export function commandReferenceSourceByKind(kind: string) {
  return commandReferenceSources().find((source) => source.kind === kind);
}
