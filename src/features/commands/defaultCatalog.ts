import { INVENTORY_STARTER_COMMANDS } from "../inventory/defaultCommands";
import { STATE_STARTER_COMMANDS } from "../state/defaultCommands";
import type { CommandProjectSettings } from "./model";

/**
 * Starter-project language contributions. These are project defaults, not
 * parser rules: once materialized in ProjectSettings they are ordinary author
 * data and may be changed or removed completely.
 */
export const DEFAULT_COMMAND_PROJECT_SETTINGS: CommandProjectSettings = {
  referenceSources: [],
  commands: structuredClone([
    ...INVENTORY_STARTER_COMMANDS,
    ...STATE_STARTER_COMMANDS,
  ]),
};
