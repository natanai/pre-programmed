/** One-way conversion for authored data created by the path-only prototype. */
export function legacyAssetId(path: string) {
  if (!path) return "";
  return path.startsWith("repo:") ? path : `repo:/${path.replace(/^\/+/, "")}`;
}
