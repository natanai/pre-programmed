import { APPLICATION_STARTER_COMMANDS } from "../../engine/application/starterCommands";
import type { CommandProjectSettings } from "./model";

export const DEFAULT_COMMAND_PROJECT_SETTINGS: CommandProjectSettings = {
  referenceSources: [],
  commands: structuredClone([...APPLICATION_STARTER_COMMANDS]),
};
