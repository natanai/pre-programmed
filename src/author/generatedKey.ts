export function normalizeAuthorKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function resolveAuthorKey({
  override,
  source,
  existingKeys,
  fallback = "entry",
}: {
  override?: string;
  source: string;
  existingKeys: Iterable<string>;
  fallback?: string;
}) {
  const explicit = normalizeAuthorKey(override ?? "");
  if (explicit) return explicit;

  const base = normalizeAuthorKey(source) || normalizeAuthorKey(fallback) || "entry";
  const occupied = new Set(Array.from(existingKeys, normalizeAuthorKey).filter(Boolean));
  if (!occupied.has(base)) return base;

  let suffix = 2;
  while (occupied.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
