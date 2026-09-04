import type { ApplicationCommandCapability } from "../../engine/application/capability";

/**
 * Portable session behavior exposed through stable engine operations. Player
 * wording is supplied by ordinary editable Player Commands.
 */
export const SESSION_APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [
  {
    operation: "session.save-file",
    label: "Save Game",
    description: "Download the current player session as a portable save file.",
    action: {
      type: "open-player-workspace",
      feature: "session",
      workspace: "file",
      data: { mode: "save" },
    },
  },
  {
    operation: "session.load-file",
    label: "Load Game",
    description: "Load a portable player save file.",
    action: {
      type: "open-player-workspace",
      feature: "session",
      workspace: "file",
      data: { mode: "load" },
    },
  },
];
