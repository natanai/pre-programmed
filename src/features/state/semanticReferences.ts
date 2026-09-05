import type { SemanticReferenceProvider } from "../../engine/references/types";
import { readComputedValue } from "./runtimeValues";

export const STATE_SEMANTIC_REFERENCE_PROVIDERS: readonly SemanticReferenceProvider[] = [
  {
    kind: "state.variable",
    label: "Variables",
    description: "Authored mutable values, including flags and numeric player state.",
    authorResourceKind: "variable",
    targetable: true,
    candidates: ({ snapshot, state }) => snapshot.variables.map((definition) => ({
      id: definition.id,
      key: definition.key,
      label: definition.label || definition.key,
      detail: definition.valueType,
      aliases: [definition.label, definition.key].filter(Boolean),
      defaultProjection: "value",
      projections: {
        value: state.values[definition.key] ?? null,
        key: definition.key,
        label: definition.label,
      },
      target: { kind: "variable", id: definition.id },
      author: { resourceKind: "variable", resourceId: definition.id },
    })),
    projectResource: (id, snapshot) => snapshot.variables.some((definition) => definition.id === id)
      ? { resourceKind: "variable", resourceId: id }
      : null,
  },
  {
    kind: "state.computed",
    label: "Computed values",
    description: "Authored read-only values calculated from the current run.",
    authorResourceKind: "computed",
    targetable: true,
    candidates: ({ snapshot, state, now }) => snapshot.computedValues.map((definition) => ({
      id: definition.id,
      key: definition.key,
      label: definition.label || definition.key,
      detail: definition.source,
      aliases: [definition.label, definition.key].filter(Boolean),
      defaultProjection: "value",
      defaultFormat: definition.format,
      projections: {
        value: readComputedValue(definition, snapshot, state, now),
        key: definition.key,
        label: definition.label,
      },
      target: { kind: "computed", id: definition.id },
      author: { resourceKind: "computed", resourceId: definition.id },
    })),
    projectResource: (id, snapshot) => snapshot.computedValues.some((definition) => definition.id === id)
      ? { resourceKind: "computed", resourceId: id }
      : null,
  },
];
