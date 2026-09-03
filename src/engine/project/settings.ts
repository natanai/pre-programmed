import {
  DEFAULT_COMMANDS_PROJECT_SETTINGS,
  normalizeCommandsProjectSettings,
  type CommandsProjectSettingsSlice,
} from "../../features/commands/projectSettings";
import type { ProjectSnapshot } from "./model";

export type ProjectSettings = {
  /** Player-facing terminal prompt for this game/project. */
  terminalPrompt: string;
} & CommandsProjectSettingsSlice;

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  terminalPrompt: "U:\\>",
  ...structuredClone(DEFAULT_COMMANDS_PROJECT_SETTINGS),
};

/**
 * Read old/partial persisted settings without requiring a data migration for
 * every future optional setting. Core normalizes only core-owned settings and
 * composes feature-owned setting slices through their feature boundaries.
 */
export function normalizeProjectSettings(value: unknown): ProjectSettings {
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    terminalPrompt: typeof root.terminalPrompt === "string" && root.terminalPrompt.trim()
      ? root.terminalPrompt.slice(0, 32)
      : DEFAULT_PROJECT_SETTINGS.terminalPrompt,
    ...normalizeCommandsProjectSettings(root),
  };
}

type SnapshotLike = Omit<ProjectSnapshot, "settings"> & { settings?: unknown };

/** Accept cached snapshots written before project settings existed. */
export function normalizeProjectSnapshot(snapshot: SnapshotLike): ProjectSnapshot {
  return { ...snapshot, settings: normalizeProjectSettings(snapshot.settings) };
}
