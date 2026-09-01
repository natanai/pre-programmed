export function upsertById<T extends { id: string }>(values: T[], next: T) {
  return values.some((value) => value.id === next.id)
    ? values.map((value) => (value.id === next.id ? next : value))
    : [...values, next];
}
