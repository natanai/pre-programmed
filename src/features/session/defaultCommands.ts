import type { CommandDefinition } from "../commands/model";

/**
 * Starter player wording for portable session actions. These definitions are
 * installed into project command data once, then belong entirely to the author.
 */
export const SESSION_STARTER_COMMANDS: readonly CommandDefinition[] = [
  {
    id: "starter-session-save-file",
    label: "Save Game",
    operation: "session.save-file",
    enabled: true,
    patterns: ["save", "save game"],
    slots: [],
    targetSlot: "",
  },
  {
    id: "starter-session-load-file",
    label: "Load Game",
    operation: "session.load-file",
    enabled: true,
    patterns: ["load", "load game"],
    slots: [],
    targetSlot: "",
  },
];
