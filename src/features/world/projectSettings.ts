import type { ConditionalSelectionMode } from "../../engine/rules/conditionalSelection";

export type WorldDefaults = {
  characterStartingNameSelection: ConditionalSelectionMode;
  interactable: boolean;
};
export type WorldProjectSettingsSlice = { worldDefaults: WorldDefaults };
export const DEFAULT_WORLD_DEFAULTS: WorldDefaults = {
  characterStartingNameSelection: "first",
  interactable: false,
};
export const DEFAULT_WORLD_PROJECT_SETTINGS: WorldProjectSettingsSlice = {
  worldDefaults: { ...DEFAULT_WORLD_DEFAULTS },
};
export function normalizeWorldProjectSettings(root: Record<string, unknown>): WorldProjectSettingsSlice {
  const raw = root.worldDefaults && typeof root.worldDefaults === "object"
    ? root.worldDefaults as Record<string, unknown>
    : {};
  return {
    worldDefaults: {
      characterStartingNameSelection: raw.characterStartingNameSelection === "random" ? "random" : "first",
      interactable: typeof raw.interactable === "boolean" ? raw.interactable : DEFAULT_WORLD_DEFAULTS.interactable,
    },
  };
}
