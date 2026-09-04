import type { CommandReferenceSource } from "../commands/referenceSource";

export const STATE_COMMAND_REFERENCE_SOURCES: readonly CommandReferenceSource[] = [
  {
    kind: "state.variable",
    label: "VARIABLES",
    description: "Let command patterns refer to authored state variables by label or key.",
    authorResourceKind: "variable",
    candidates: (snapshot) => snapshot.variables.map((definition) => ({
      id: definition.id,
      label: definition.label,
      aliases: [definition.label, definition.key],
      target: { kind: "variable", id: definition.id },
    })),
  },
  {
    kind: "state.computed",
    label: "COMPUTED VALUES",
    description: "Let command patterns refer to authored computed values by label or key.",
    authorResourceKind: "computed",
    candidates: (snapshot) => snapshot.computedValues.map((definition) => ({
      id: definition.id,
      label: definition.label,
      aliases: [definition.label, definition.key],
      target: { kind: "computed", id: definition.id },
    })),
  },
];
