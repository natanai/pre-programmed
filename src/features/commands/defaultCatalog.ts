import { INVENTORY_STARTER_COMMANDS } from "../inventory/defaultCommands";
import { SESSION_STARTER_COMMANDS } from "../session/defaultCommands";
import { STATE_STARTER_COMMANDS } from "../state/defaultCommands";
import type { CommandDefinition, CommandProjectSettings } from "./model";

type StarterCommandRelease = {
  revision: number;
  commands: readonly CommandDefinition[];
};

/**
 * Starter-project language contributions. Releases let existing projects pick
 * up newly introduced starter commands exactly once. After installation the
 * definitions are ordinary project data and may be renamed, disabled, edited,
 * or deleted without reappearing.
 *
 * Revisions 1-2 predate explicit tracking. Existing projects without a stored
 * revision are treated as having already seen them so older author deletions are
 * never resurrected. Revision 3 is the first tracked release.
 */
export const COMMAND_STARTER_RELEASES: readonly StarterCommandRelease[] = [
  { revision: 1, commands: INVENTORY_STARTER_COMMANDS },
  { revision: 2, commands: STATE_STARTER_COMMANDS },
  { revision: 3, commands: SESSION_STARTER_COMMANDS },
];

export const LEGACY_COMMAND_STARTER_REVISION = 2;
export const CURRENT_COMMAND_STARTER_REVISION = Math.max(
  0,
  ...COMMAND_STARTER_RELEASES.map((release) => release.revision),
);

export function starterCommandsAfter(revision: number): CommandDefinition[] {
  return structuredClone(
    COMMAND_STARTER_RELEASES
      .filter((release) => release.revision > revision)
      .flatMap((release) => release.commands),
  );
}

export const DEFAULT_COMMAND_PROJECT_SETTINGS: CommandProjectSettings = {
  starterRevision: CURRENT_COMMAND_STARTER_REVISION,
  referenceSources: [],
  commands: starterCommandsAfter(0),
};
