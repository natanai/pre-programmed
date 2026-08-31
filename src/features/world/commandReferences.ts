import type { CommandReferenceSource } from "../commands/referenceSource";

export const WORLD_COMMAND_REFERENCE_SOURCES: readonly CommandReferenceSource[] = [
  {
    kind: "world.character",
    label: "CHARACTERS",
    description: "Let command patterns refer to authored characters by their names, keys, tags, and aliases.",
    candidates: (snapshot) => snapshot.entities
      .filter((entity) => entity.type === "character")
      .map((entity) => ({
        id: entity.id,
        label: entity.name,
        aliases: [entity.name, entity.key, ...entity.tags],
        target: { kind: "world.character", id: entity.id },
      })),
  },
  {
    kind: "world.location",
    label: "LOCATIONS",
    description: "Let command patterns refer to authored locations by their names, keys, tags, and aliases.",
    candidates: (snapshot) => snapshot.entities
      .filter((entity) => entity.type === "location")
      .map((entity) => ({
        id: entity.id,
        label: entity.name,
        aliases: [entity.name, entity.key, ...entity.tags],
        target: { kind: "world.location", id: entity.id },
      })),
  },
];
