import { SEMANTIC_REFERENCE_PROVIDERS, semanticReferenceProvider } from "./catalog";
import {
  findSemanticReferenceTokens,
  semanticReferenceCandidate,
  type SemanticReferenceToken,
} from "./runtime";
import { makeSemanticReferenceToken } from "./syntax";
import type {
  SemanticReferenceCandidate,
  SemanticReferenceContext,
  SemanticReferenceProvider,
} from "./types";

type ReferenceReplacement = {
  storedStart: number;
  storedEnd: number;
  displayStart: number;
  displayEnd: number;
};

export type AuthorSemanticReferenceView = {
  text: string;
  toStoredIndex: (displayIndex: number) => number;
  toDisplayIndex: (storedIndex: number) => number;
};

function projectionSuffix(
  candidate: SemanticReferenceCandidate,
  projection: string | null | undefined,
  format: string | null | undefined,
) {
  const effectiveProjection = projection || candidate.defaultProjection;
  const effectiveFormat = format || candidate.defaultFormat;
  const showProjection = Boolean(projection && projection !== candidate.defaultProjection) || Boolean(format);
  const showFormat = Boolean(format && format !== candidate.defaultFormat);
  return `${showProjection ? `|${effectiveProjection}` : ""}${showFormat ? `|${effectiveFormat}` : ""}`;
}

/** Human-facing editable syntax for one semantic reference. Stable ids stay below this boundary. */
export function authorSyntaxForSemanticReference(
  provider: SemanticReferenceProvider,
  candidate: SemanticReferenceCandidate,
  projection?: string | null,
  format?: string | null,
) {
  const suffix = projectionSuffix(candidate, projection, format);
  if (candidate.contextual) return `{{${candidate.key}${suffix}}}`;
  return `{{${provider.authorSyntax ?? provider.kind}:${candidate.key}${suffix}}}`;
}

function authorSyntaxForStoredToken(token: SemanticReferenceToken, context: SemanticReferenceContext) {
  const provider = semanticReferenceProvider(token.kind);
  const candidate = semanticReferenceCandidate(token.kind, token.id, context);
  if (!provider || !candidate) return token.token;
  return authorSyntaxForSemanticReference(provider, candidate, token.projection, token.format);
}

function mapIndex(
  index: number,
  replacements: readonly ReferenceReplacement[],
  from: "stored" | "display",
) {
  const fromStart = from === "stored" ? "storedStart" : "displayStart";
  const fromEnd = from === "stored" ? "storedEnd" : "displayEnd";
  const toStart = from === "stored" ? "displayStart" : "storedStart";
  const toEnd = from === "stored" ? "displayEnd" : "storedEnd";
  let delta = 0;
  for (const replacement of replacements) {
    const start = replacement[fromStart];
    const end = replacement[fromEnd];
    const mappedStart = replacement[toStart];
    const mappedEnd = replacement[toEnd];
    if (index < start) return Math.max(0, index + delta);
    if (index <= end) {
      if (index === start) return mappedStart;
      if (index === end) return mappedEnd;
      const ratio = (index - start) / Math.max(1, end - start);
      return Math.round(mappedStart + ratio * (mappedEnd - mappedStart));
    }
    delta += (mappedEnd - mappedStart) - (end - start);
  }
  return Math.max(0, index + delta);
}

/**
 * Present stable persisted references as compact human syntax while preserving a
 * reversible position map for ordinary textarea selection/caret behavior.
 */
export function authorSemanticReferenceView(
  template: string,
  context: SemanticReferenceContext,
): AuthorSemanticReferenceView {
  const tokens = findSemanticReferenceTokens(template);
  if (!tokens.length) {
    return {
      text: template,
      toStoredIndex: (index) => index,
      toDisplayIndex: (index) => index,
    };
  }
  const replacements: ReferenceReplacement[] = [];
  let storedCursor = 0;
  let display = "";
  for (const token of tokens) {
    display += template.slice(storedCursor, token.index);
    const displayStart = display.length;
    const authorText = authorSyntaxForStoredToken(token, context);
    display += authorText;
    replacements.push({
      storedStart: token.index,
      storedEnd: token.index + token.token.length,
      displayStart,
      displayEnd: display.length,
    });
    storedCursor = token.index + token.token.length;
  }
  display += template.slice(storedCursor);
  return {
    text: display,
    toStoredIndex: (index) => mapIndex(index, replacements, "display"),
    toDisplayIndex: (index) => mapIndex(index, replacements, "stored"),
  };
}

function matchingContextualReference(head: string, context: SemanticReferenceContext) {
  const normalized = head.toLowerCase();
  const matches = SEMANTIC_REFERENCE_PROVIDERS.flatMap((provider) => provider.candidates(context)
    .filter((candidate) => candidate.contextual && candidate.key.toLowerCase() === normalized)
    .map((candidate) => ({ provider, candidate })));
  return matches.length === 1 ? matches[0] : null;
}

function matchingStaticReference(namespace: string, key: string, context: SemanticReferenceContext) {
  const normalizedNamespace = namespace.toLowerCase();
  const normalizedKey = key.toLowerCase();
  const provider = SEMANTIC_REFERENCE_PROVIDERS.find((candidate) =>
    (candidate.authorSyntax ?? candidate.kind).toLowerCase() === normalizedNamespace);
  if (!provider) return null;
  const candidates = provider.candidates(context)
    .filter((candidate) => !candidate.contextual && candidate.key.toLowerCase() === normalizedKey);
  return candidates.length === 1 ? { provider, candidate: candidates[0] } : null;
}

/** Convert editable human syntax back to stable persisted semantic-reference ids. */
export function storeAuthorSemanticReferences(template: string, context: SemanticReferenceContext) {
  return template.replace(/\{\{([^{}]+)\}\}/g, (raw, body: string) => {
    if (body.startsWith("ref:")) return raw;
    const [head, projection, format] = body.split("|");
    const colon = head.indexOf(":");
    const match = colon >= 0
      ? matchingStaticReference(head.slice(0, colon), head.slice(colon + 1), context)
      : matchingContextualReference(head, context);
    if (!match) return raw;
    return makeSemanticReferenceToken(
      match.provider.kind,
      match.candidate.id,
      projection || match.candidate.defaultProjection,
      format || match.candidate.defaultFormat,
    );
  });
}
