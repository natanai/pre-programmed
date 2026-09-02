import type { CommandReferenceSource } from "../commands/referenceSource";

export const VALUES_COMMAND_REFERENCE_SOURCES: readonly CommandReferenceSource[] = [
  {
    kind: "values.value",
    label: "VALUES",
    description: "Let command patterns refer to authored values by label or key.",
    candidates: (snapshot) => snapshot.valueDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      aliases: [definition.label, definition.key],
      target: { kind: "value", id: definition.id },
    })),
  },
  {
    kind: "values.derived",
    label: "DERIVED VALUES",
    description: "Let command patterns refer to read-only derived values by label or key.",
    candidates: (snapshot) => snapshot.derivedValueDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      aliases: [definition.label, definition.key],
      target: { kind: "derived", id: definition.id },
    })),
  },
];
