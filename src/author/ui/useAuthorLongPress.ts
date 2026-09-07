import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

const DEFAULT_DELAY_MS = 450;
const DEFAULT_MOVE_TOLERANCE_PX = 10;

type AuthorLongPressOptions = {
  enabled?: boolean;
  delayMs?: number;
  moveTolerancePx?: number;
  onLongPress: () => void;
};

/**
 * Shared coarse-pointer accelerator for Author mode.
 *
 * Long-press is never an ownership or persistence mechanism: callers must also
 * expose the same action through an ordinary visible control. This helper only
 * shortens access to that existing action on touch/pen devices. Mouse input is
 * deliberately ignored so desktop remains free to use explicit controls or a
 * future shared context-menu presentation.
 */
export function useAuthorLongPress({
  enabled = true,
  delayMs = DEFAULT_DELAY_MS,
  moveTolerancePx = DEFAULT_MOVE_TOLERANCE_PX,
  onLongPress,
}: AuthorLongPressOptions) {
  const timerRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const resetPointer = useCallback(() => {
    clearTimer();
    pointerIdRef.current = null;
  }, [clearTimer]);

  useEffect(() => resetPointer, [resetPointer]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!enabled || !event.isPrimary || (event.pointerType !== "touch" && event.pointerType !== "pen")) return;
    resetPointer();
    pointerIdRef.current = event.pointerId;
    startRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (pointerIdRef.current !== event.pointerId) return;
      suppressClickRef.current = true;
      onLongPressRef.current();
    }, delayMs);
  }, [delayMs, enabled, resetPointer]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== event.pointerId || timerRef.current === null) return;
    const deltaX = event.clientX - startRef.current.x;
    const deltaY = event.clientY - startRef.current.y;
    if (Math.hypot(deltaX, deltaY) > moveTolerancePx) resetPointer();
  }, [moveTolerancePx, resetPointer]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    resetPointer();
  }, [resetPointer]);

  const onPointerCancel = useCallback((event: PointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    resetPointer();
  }, [resetPointer]);

  const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
  };
}
