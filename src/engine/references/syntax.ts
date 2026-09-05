export function semanticReferenceTokenPattern() {
  return /\{\{ref:([^:|}]+):([^|}]+)(?:\|([^|}]+))?(?:\|([^}]+))?\}\}/g;
}

/** Stable persisted reference syntax. Friendly @ names are discovery-only and never stored. */
export function makeSemanticReferenceToken(
  kind: string,
  id: string,
  projection?: string,
  format?: string,
) {
  return `{{ref:${kind}:${id}${projection ? `|${projection}` : ""}${format ? `|${format}` : ""}}}`;
}
