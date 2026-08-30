import type { ComputedDefinition, PlayState, ProjectSnapshot, Value } from "./model";
import { readComputedValue } from "./runtimeValues";

const TOKEN_PATTERN = /\{\{(variable|computed):([a-z][a-z0-9_-]*)(?:\|([a-z]+))?\}\}/gi;

export type InterpolationContext = {
  snapshot: ProjectSnapshot;
  state: PlayState;
  now?: number;
};

function formatValue(value: Value, format = "raw") {
  if (value === null || value === undefined) return "";
  if (format === "integer" && typeof value === "number") return String(Math.round(value));
  if (format === "seconds" && typeof value === "number") return `${Math.round(value)}s`;
  return String(value);
}

function computedByKey(snapshot: ProjectSnapshot, key: string): ComputedDefinition | undefined {
  return snapshot.computedValues.find((definition) => definition.key === key);
}

export function interpolateText(template: string, context: InterpolationContext) {
  return template.replace(TOKEN_PATTERN, (_token, source: string, key: string, format?: string) => {
    if (source.toLowerCase() === "variable") {
      return formatValue(context.state.values[key], format);
    }

    const definition = computedByKey(context.snapshot, key);
    if (!definition) return "";
    const value = readComputedValue(definition, context.snapshot, context.state, context.now);
    return formatValue(value, format ?? definition.format);
  });
}

export function makeValueToken(source: "variable" | "computed", key: string, format?: string) {
  return `{{${source}:${key}${format ? `|${format}` : ""}}}`;
}

export function findInterpolationTokens(template: string) {
  return Array.from(template.matchAll(TOKEN_PATTERN), (match) => ({
    token: match[0],
    source: match[1].toLowerCase() as "variable" | "computed",
    key: match[2],
    format: match[3] ?? null,
  }));
}
