import { useSyncExternalStore, useState } from "react";
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
  | { type: "item"; item?: ItemDefinition };

type GuardSnapshot = { dirty: boolean; pending: boolean };

let guardSnapshot: GuardSnapshot = { dirty: false, pending: false };
let pendingDiscard: (() => void) | null = null;
const guardListeners = new Set<() => void>();

function emitGuard(next: GuardSnapshot) {
  if (next.dirty === guardSnapshot.dirty && next.pending === guardSnapshot.pending) return;
  guardSnapshot = next;
  guardListeners.forEach((listener) => listener());
}

export function setWorkSurfaceDirty(dirty: boolean) {
  emitGuard({ ...guardSnapshot, dirty });
}

export function requestWorkSurfaceDiscard(discard: () => void) {
  if (!guardSnapshot.dirty) {
    discard();
    return;
  }
  pendingDiscard = discard;
  emitGuard({ ...guardSnapshot, pending: true });
}

export function confirmWorkSurfaceDiscard() {
  const discard = pendingDiscard;
  pendingDiscard = null;
  emitGuard({ dirty: false, pending: false });
  discard?.();
}

export function cancelWorkSurfaceDiscard() {
  pendingDiscard = null;
  emitGuard({ ...guardSnapshot, pending: false });
}

export function useWorkSurfaceGuard() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      guardListeners.add(listener);
      return () => guardListeners.delete(listener);
    },
    () => guardSnapshot,
    () => guardSnapshot,
  );
  return {
    ...snapshot,
    setDirty: setWorkSurfaceDirty,
    requestDiscard: requestWorkSurfaceDiscard,
    confirmDiscard: confirmWorkSurfaceDiscard,
    cancelDiscard: cancelWorkSurfaceDiscard,
  };
}

/**
 * Navigation owner for temporary play/Author work surfaces.
 *
 * Opening from play replaces the stack. Moving from an Author index or parent
 * workspace pushes onto it. This keeps Back deterministic without making each
 * feature know about its parent, while Close always returns directly to play.
 * Every Author workspace uses this same route stack; features do not maintain
 * parallel open/closed state beside it.
 *
 * Navigation that would leave a dirty Author draft is deferred until the
 * shared guard is explicitly confirmed. Read-only workspaces stay instant.
 */
export function useWorkSurfaceNavigation() {
  const [stack, setStack] = useState<AuthorPanelRoute[]>([]);
  const panel = stack.at(-1) ?? null;

  const openPanel = (route: AuthorPanelRoute) => requestWorkSurfaceDiscard(() => setStack([route]));
  const pushPanel = (route: AuthorPanelRoute) => requestWorkSurfaceDiscard(() => setStack((currentStack) => [...currentStack, route]));
  const back = () => requestWorkSurfaceDiscard(() => setStack((currentStack) => currentStack.slice(0, -1)));
  const close = () => requestWorkSurfaceDiscard(() => setStack([]));

  return {
    panel,
    canBack: stack.length > 1,
    depth: stack.length,
    openPanel,
    pushPanel,
    back,
    close,
  };
}
