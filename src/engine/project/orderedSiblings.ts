export type OrderedSibling = {
  id: string;
  /** Durable authored position within one owner-defined sibling collection. Legacy snapshots may omit it. */
  order?: number;
};

export type SiblingMoveDirection = -1 | 1;

function authoredOrder(value: OrderedSibling, fallback: number) {
  return Number.isInteger(value.order) ? value.order as number : fallback;
}

/**
 * Return siblings in canonical authored order without mutating the source array.
 * The original array position is the compatibility fallback for legacy snapshots
 * that predate durable order data.
 */
export function orderedSiblings<T extends OrderedSibling>(values: readonly T[]): T[] {
  return values
    .map((value, index) => ({ value, index, order: authoredOrder(value, index) }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map(({ value }) => value);
}

/** Compact one sibling collection to contiguous durable positions. */
export function normalizeSiblingOrder<T extends OrderedSibling>(values: readonly T[]): T[] {
  return orderedSiblings(values).map((value, order) => ({ ...value, order }));
}

/** Append after the currently authored sibling sequence. */
export function nextSiblingOrder<T extends OrderedSibling>(values: readonly T[]) {
  const ordered = orderedSiblings(values);
  if (!ordered.length) return 0;
  return Math.max(...ordered.map((value, index) => authoredOrder(value, index))) + 1;
}

/** Move one sibling by one position and compact the resulting collection. */
export function moveSibling<T extends OrderedSibling>(
  values: readonly T[],
  id: string,
  direction: SiblingMoveDirection,
): T[] {
  const ordered = orderedSiblings(values);
  const index = ordered.findIndex((value) => value.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered.map((value, order) => ({ ...value, order }));
}

/**
 * Apply an explicitly requested sibling sequence. Missing siblings are retained
 * after it in their previous authored order, so partial callers cannot lose data.
 */
export function applySiblingOrder<T extends OrderedSibling>(
  values: readonly T[],
  orderedIds: readonly string[],
): T[] {
  const current = orderedSiblings(values);
  const byId = new Map(current.map((value) => [value.id, value]));
  const seen = new Set<string>();
  const requested: T[] = [];

  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    const value = byId.get(id);
    if (!value) continue;
    seen.add(id);
    requested.push(value);
  }

  return [...requested, ...current.filter((value) => !seen.has(value.id))]
    .map((value, order) => ({ ...value, order }));
}
