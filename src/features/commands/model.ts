import type { OperationId } from "../operations/model";

/**
 * Project-level policy for one feature-contributed reference source.
 *
 * Source kinds are stable module IDs such as `world.location`,
 * `world.character`, `inventory.item`, or `state.variable`. The Commands
 * feature does not know how those sources are resolved; feature adapters do.
 */
export type ReferenceSourceSetting = {
  sourceKind: string;
  enabled: boolean;
  /** Include the source adapter's normal names/labels/keys/tags. */
  includeDefaults: boolean;
  /** Optional per-definition aliases keyed by the source definition id. */
  aliases: Record<string, string[]>;
};

export type CommandSlotDefinition = {
  /** Placeholder name used in patterns, e.g. `target` in `examine {target}`. */
  name: string;
  /** Feature-contributed reference source kind, or `text` for free text. */
  sourceKind: string;
};

/**
 * One author-defined terminal grammar rule.
 *
 * Nothing here gives special meaning to LOOK/GO/TAKE/etc. A game can define
 * any operation vocabulary it wants, including zero traditional IF verbs.
 */
export type CommandDefinition = {
  id: string;
  label: string;
  operation: OperationId;
  enabled: boolean;
  /** Patterns such as `{location}`, `go {location}`, `give {item} to {person}`. */
  patterns: string[];
  slots: CommandSlotDefinition[];
  /** Slot whose resolved target receives the operation. Empty for meta/text-only commands. */
  targetSlot: string;
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
