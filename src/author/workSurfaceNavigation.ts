import { useState } from "react";
import type { GameNode, Interaction, ItemDefinition } from "../game/model";

export type AuthorPanelRoute =
  | { type: "node"; node: GameNode }
  | { type: "interaction"; interaction?: Interaction; command?: string; fallback?: boolean }
  | { type: "tools" }
  | { type: "definitions" }
  | { type: "structure" }
  | { type: "assets" }
  | { type: "synth" }
  | { type: "workspace"; view?: "locations" | "history" }
  | { type: "item"; item?: ItemDefinition };

type WorkSurface =
  | { kind: "panel"; panel: AuthorPanelRoute }
  | { kind: "inventory" };

/**
 * Navigation owner for temporary play/Author work surfaces.
 *
 * Opening from play replaces the stack. Moving from an Author index or parent
 * workspace pushes onto it. This keeps Back deterministic without making each
 * feature know about its parent, while Close always returns directly to play.
 */
export function useWorkSurfaceNavigation() {
  const [stack, setStack] = useState<WorkSurface[]>([]);
  const current = stack.at(-1) ?? null;

  const openPanel = (panel: AuthorPanelRoute) => setStack([{ kind: "panel", panel }]);
  const openInventory = () => setStack([{ kind: "inventory" }]);
  const pushPanel = (panel: AuthorPanelRoute) => setStack((currentStack) => [...currentStack, { kind: "panel", panel }]);
  const pushInventory = () => setStack((currentStack) => [...currentStack, { kind: "inventory" }]);
  const back = () => setStack((currentStack) => currentStack.slice(0, -1));
  const close = () => setStack([]);

  return {
    panel: current?.kind === "panel" ? current.panel : null,
    inventoryOpen: current?.kind === "inventory",
    canBack: stack.length > 1,
    depth: stack.length,
    openPanel,
    openInventory,
    pushPanel,
    pushInventory,
    back,
    close,
  };
}
