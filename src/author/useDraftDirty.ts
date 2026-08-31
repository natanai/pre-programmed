import { useEffect, useRef } from "react";

/**
 * Reports whether a local Author draft has diverged from its last saved/opened
 * baseline without coupling navigation policy to any feature editor.
 */
export function useDraftDirty<T>(draft: T, onDirtyChange?: (dirty: boolean) => void) {
  const serialized = JSON.stringify(draft);
  const baseline = useRef(serialized);

  useEffect(() => {
    onDirtyChange?.(serialized !== baseline.current);
  }, [serialized, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const markSaved = () => {
    baseline.current = serialized;
    onDirtyChange?.(false);
  };

  const resetBaseline = (next: T) => {
    baseline.current = JSON.stringify(next);
    onDirtyChange?.(false);
  };

  return { markSaved, resetBaseline };
}
