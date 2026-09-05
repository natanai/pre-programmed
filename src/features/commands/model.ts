import type { Effect } from "../../engine/rules/model";
import type { TextPerformance } from "../narrative/model";
import type { OperationId } from "../operations/model";

/**
 * Project-level player vocabulary for one feature-contributed semantic reference kind.
 * Resolution belongs to the reference provider; Commands only owns whether players may
 * use its normal names and any project-specific aliases.
 */
export type ReferenceSourceSetting = {
  sourceKind: string;
  enabled: boolean;
  includeDefaults: boolean;
  /** Optional per-definition aliases keyed by stable semantic candidate id. */
  aliases: Record<string, string[]>;
};

export type CommandSlotDefinition = {
  /** Placeholder name used in patterns, e.g. `target` in `examine {target}`. */
  name: string;
  /** Empty means free text. Several kinds make one semantic target slot polymorphic. */
  sourceKinds: string[];
};

export type CommandResponseAction = {
  type: "response";
  responseText: string;
  responsePerformance: TextPerformance;
  speakerId: string | null;
  effects: Effect[];
};

export type CommandApplicationAction = {
  type: "application";
  operation: OperationId;
};

export type CommandTargetOperationAction = {
  type: "target-operation";
  operation: OperationId;
  targetSlot: string;
};

/**
 * Project-wide Player Command behavior. Commands coordinates shared contracts;
 * it does not reimplement the owning feature's player surface, Effects, or target runtime.
 */
export type CommandAction =
  | CommandResponseAction
  | CommandApplicationAction
  | CommandTargetOperationAction;

export type CommandDefinition = {
  id: string;
  label: string;
  enabled: boolean;
  /** Patterns such as `{location}`, `go {location}`, `give {item} to {person}`. */
  patterns: string[];
  slots: CommandSlotDefinition[];
  action: CommandAction;
};

export type CommandProjectSettings = {
  /**
   * Highest starter-command release this project has seen. Starter commands are
   * installed only when crossing a newer release, then remain ordinary author
   * data so edits/deletions are never silently repaired.
   */
  starterRevision: number;
  referenceSources: ReferenceSourceSetting[];
  commands: CommandDefinition[];
};

export const EMPTY_COMMAND_PROJECT_SETTINGS: CommandProjectSettings = {
  starterRevision: 0,
  referenceSources: [],
  commands: [],
};
