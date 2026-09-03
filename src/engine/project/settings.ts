import {
  DEFAULT_COMMANDS_PROJECT_SETTINGS,
  normalizeCommandsProjectSettings,
  type CommandsProjectSettingsSlice,
} from "../../features/commands/projectSettings";
import {
  normalizeInventoryMutationOperation,
  normalizeInventoryProjectSlice,
} from "../../features/inventory/projectNormalization";
import { normalizeStateProjectSlice } from "../../features/state/projectNormalization";
import type { ProjectMutation, ProjectSnapshot } from "./model";

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

type SnapshotLike = Omit<
  ProjectSnapshot,
  "settings" | "stateGroups" | "items" | "bodyBackgrounds" | "startingBodyBackgroundId"
> & {
  settings?: unknown;
  stateGroups?: ProjectSnapshot["stateGroups"];
  items?: unknown;
  bodyBackgrounds?: unknown;
  startingBodyBackgroundId?: unknown;
};

/**
 * Accept cached snapshots written before newer optional project slices existed.
 * Feature-owned normalizers carry their own one-way compatibility semantics;
 * this composition root only assembles the normalized snapshot.
 */
export function normalizeProjectSnapshot(snapshot: SnapshotLike): ProjectSnapshot {
  return {
    ...snapshot,
    ...normalizeStateProjectSlice(snapshot),
    ...normalizeInventoryProjectSlice(snapshot),
    settings: normalizeProjectSettings(snapshot.settings),
  };
}

/**
 * Normalize only historical payloads recovered from the browser mutation queue.
 * Newly authored operations already use current feature contracts.
 */
export function normalizeProjectMutationForReplay(mutation: ProjectMutation): ProjectMutation {
  return {
    ...mutation,
    operations: mutation.operations.map(normalizeInventoryMutationOperation),
  };
}
