import type { ApplicationCommandCapability } from "../../engine/application/capability";

/**
 * Player-session commands are engine-level application commands rather than
 * authored story vocabulary. They stay available in every project while still
 * flowing through the shared command parser and application-capability path.
 */
export const SESSION_APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [
  {
    operation: "session.save-file",
    label: "Save Game",
    description: "Download the current player session as a portable save file.",
    systemPatterns: ["save", "save game"],
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
    systemPatterns: ["load", "load game"],
    action: {
      type: "open-player-workspace",
      feature: "session",
      workspace: "file",
      data: { mode: "load" },
    },
  },
];
