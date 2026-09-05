import type { ProjectSnapshot } from "../project/model";
import { makeSemanticReferenceToken } from "./runtime";

const LEGACY_VALUE_TOKEN = /\{\{(variable|computed):([a-z][a-z0-9_-]*)(?:\|([a-z]+))?\}\}/gi;

/** Convert the former State-only text grammar into stable semantic-reference ids. */
export function migrateLegacyReferenceTokens(template: string, snapshot: ProjectSnapshot) {
  return template.replace(LEGACY_VALUE_TOKEN, (raw, source: string, key: string, format?: string) => {
    if (source.toLowerCase() === "variable") {
      const definition = snapshot.variables.find((candidate) => candidate.key === key);
      return definition
        ? makeSemanticReferenceToken("state.variable", definition.id, "value", format)
        : raw;
    }
    const definition = snapshot.computedValues.find((candidate) => candidate.key === key);
    return definition
      ? makeSemanticReferenceToken("state.computed", definition.id, "value", format ?? definition.format)
      : raw;
  });
}

function migrateValue(value: unknown, snapshot: ProjectSnapshot): unknown {
  if (typeof value === "string") return migrateLegacyReferenceTokens(value, snapshot);
  if (Array.isArray(value)) return value.map((item) => migrateValue(item, snapshot));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [key, migrateValue(item, snapshot)]));
}

/**
 * Read-boundary compatibility only. The runtime understands one reference grammar;
 * old State tokens are normalized toward it before any player/Author consumer sees them.
 */
export function migrateSnapshotReferenceTokens(snapshot: ProjectSnapshot): ProjectSnapshot {
  return migrateValue(snapshot, snapshot) as ProjectSnapshot;
}
