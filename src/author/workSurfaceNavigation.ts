import { useCallback, useState } from "react";
import type { GameNode, Interaction, ItemDefinition } from "../game/model";

export type AuthorPanelRoute =
  | { type: "node"; node: GameNode }
  | { type: "interaction"; interaction?: Interaction; command?: string; fallback?: boolean }
  | { type: "tools" }
  | { type: "definitions" }
  | { type: "structure" }
  | { type: "inventory" }
  | { type: "assets" }
  | { type: "synth" }
  | { type: "workspace"; view?: "locations" | "history" }
  | { type: "item"; item?: ItemDefinition }
  /** Generic extension route so new modules do not expand this central union. */
  | { type: "feature"; feature: string; workspace: string; data?: Record<string, string> };

type WorkSurfaceEntry = {
  id: string;
  route: AuthorPanelRoute;
  dirty: boolean;
};

export type AuthorLeaveConfirmation = {
  action: "back" | "close";
  dirtyCount: number;
};

function entryFor(route: AuthorPanelRoute): WorkSurfaceEntry {
  return { id: crypto.randomUUID(), route, dirty: false };
}

/**
 * Navigation owner for temporary play/Author work surfaces.
 *
 * Dirty state belongs to stack entries rather than to the whole Author UI. A
 * nested editor can therefore be clean while its parent still has unsaved
 * work. Back guards only the current route; X/close guards every dirty route in
 * the stack. Programmatic close/back remain available for successful saves.
 */
export function useWorkSurfaceNavigation() {
  const [stack, setStack] = useState<WorkSurfaceEntry[]>([]);
  const [leaveConfirmation, setLeaveConfirmation] = useState<AuthorLeaveConfirmation | null>(null);
  const current = stack.at(-1) ?? null;
  const panel = current?.route ?? null;
  const dirtyCount = stack.filter((entry) => entry.dirty).length;

  const openPanel = useCallback((route: AuthorPanelRoute) => {
    setLeaveConfirmation(null);
    setStack([entryFor(route)]);
  }, []);
  const pushPanel = useCallback((route: AuthorPanelRoute) => {
    setLeaveConfirmation(null);
    setStack((currentStack) => [...currentStack, entryFor(route)]);
  }, []);
  const back = useCallback(() => {
    setLeaveConfirmation(null);
    setStack((currentStack) => currentStack.slice(0, -1));
  }, []);
  const close = useCallback(() => {
    setLeaveConfirmation(null);
    setStack([]);
  }, []);

  const setCurrentDirty = useCallback((dirty: boolean) => {
    setStack((currentStack) => currentStack.map((entry, index) =>
      index === currentStack.length - 1 ? { ...entry, dirty } : entry));
  }, []);

  const requestBack = useCallback(() => {
    if (current?.dirty) {
      setLeaveConfirmation({ action: "back", dirtyCount: 1 });
      return;
    }
    back();
  }, [back, current?.dirty]);

  const requestClose = useCallback(() => {
    if (dirtyCount) {
      setLeaveConfirmation({ action: "close", dirtyCount });
      return;
    }
    close();
  }, [close, dirtyCount]);

  const confirmLeave = useCallback(() => {
    const action = leaveConfirmation?.action;
    if (action === "back") back();
    else if (action === "close") close();
  }, [back, close, leaveConfirmation?.action]);

  const cancelLeave = useCallback(() => setLeaveConfirmation(null), []);

  return {
    panel,
    canBack: stack.length > 1,
    depth: stack.length,
    currentDirty: Boolean(current?.dirty),
    hasDirty: dirtyCount > 0,
    leaveConfirmation,
    openPanel,
    pushPanel,
    back,
    close,
    requestBack,
    requestClose,
    confirmLeave,
    cancelLeave,
    setCurrentDirty,
  };
}
