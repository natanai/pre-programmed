import { SEMANTIC_REFERENCE_PROVIDERS, semanticReferenceProvider } from "./catalog";
import type {
  SemanticReferenceCandidate,
  SemanticReferenceContext,
  SemanticReferenceProvider,
} from "./types";

const TOKEN_PATTERN = /\{\{ref:([^:|}]+):([^|}]+)(?:\|([^|}]+))?(?:\|([^}]+))?\}\}/g;

export type SemanticReferenceToken = {
  token: string;
  kind: string;
  id: string;
  projection: string | null;
  format: string | null;
  index: number;
};

export type SemanticReferenceEntry = {
  provider: SemanticReferenceProvider;
  candidate: SemanticReferenceCandidate;
};

export function semanticReferenceEntries(context: SemanticReferenceContext): SemanticReferenceEntry[] {
  return SEMANTIC_REFERENCE_PROVIDERS.flatMap((provider) =>
    provider.candidates(context).map((candidate) => ({ provider, candidate })),
  );
}

export function semanticReferenceCandidate(
  kind: string,
  id: string,
  context: SemanticReferenceContext,
) {
  return semanticReferenceProvider(kind)?.candidates(context).find((candidate) => candidate.id === id) ?? null;
}

export function makeSemanticReferenceToken(
  kind: string,
  id: string,
  projection?: string,
  format?: string,
) {
  return `{{ref:${kind}:${id}${projection ? `|${projection}` : ""}${format ? `|${format}` : ""}}}`;
}

export function tokenForSemanticReference(
  provider: SemanticReferenceProvider,
  candidate: SemanticReferenceCandidate,
) {
  return makeSemanticReferenceToken(
    provider.kind,
    candidate.id,
    candidate.defaultProjection,
    candidate.defaultFormat,
  );
}

export function findSemanticReferenceTokens(template: string): SemanticReferenceToken[] {
  return Array.from(template.matchAll(TOKEN_PATTERN), (match) => ({
    token: match[0],
    kind: match[1],
    id: match[2],
    projection: match[3] ?? null,
    format: match[4] ?? null,
    index: match.index ?? 0,
  }));
}

function formatValue(value: unknown, format = "raw") {
  if (value === null || value === undefined) return "";
  if (format === "integer" && typeof value === "number") return String(Math.round(value));
  if (format === "seconds" && typeof value === "number") return `${Math.round(value)}s`;
  return String(value);
}

export function renderSemanticReferenceToken(
  token: Pick<SemanticReferenceToken, "kind" | "id" | "projection" | "format">,
  context: SemanticReferenceContext,
) {
  const candidate = semanticReferenceCandidate(token.kind, token.id, context);
  if (!candidate) return "";
  const projection = token.projection || candidate.defaultProjection;
  const value = candidate.projections[projection];
  return formatValue(value, token.format || candidate.defaultFormat || "raw");
}

export function interpolateSemanticReferences(template: string, context: SemanticReferenceContext) {
  return template.replace(TOKEN_PATTERN, (_raw, kind: string, id: string, projection?: string, format?: string) =>
    renderSemanticReferenceToken({
      kind,
      id,
      projection: projection ?? null,
      format: format ?? null,
    }, context));
}

export function semanticReferenceProjectResource(kind: string, id: string, context: SemanticReferenceContext) {
  const provider = semanticReferenceProvider(kind);
  if (!provider) return null;
  return provider.projectResource?.(id, context.snapshot)
    ?? provider.candidates(context).find((candidate) => candidate.id === id && !candidate.contextual)?.author
    ?? null;
}
