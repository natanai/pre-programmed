import { useState } from "react";
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

/**
 * Navigation owner for temporary play/Author work surfaces.
 *
 * Opening from play replaces the stack. Moving from an Author index or parent
 * workspace pushes onto it. This keeps Back deterministic without making each
 * feature know about its parent, while Close always returns directly to play.
 * Every Author workspace uses this same route stack; features do not maintain
 * parallel open/closed state beside it.
 */
export function useWorkSurfaceNavigation() {
  const [stack, setStack] = useState<AuthorPanelRoute[]>([]);
  const panel = stack.at(-1) ?? null;

  const openPanel = (route: AuthorPanelRoute) => setStack([route]);
  const pushPanel = (route: AuthorPanelRoute) => setStack((currentStack) => [...currentStack, route]);
  const back = () => setStack((currentStack) => currentStack.slice(0, -1));
  const close = () => setStack([]);

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
