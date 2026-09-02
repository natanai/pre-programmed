import type { ApplicationCommandCapability } from "../../engine/application/capability";

export const STATUS_APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [
  {
    operation: "status.open",
    label: "Open Status",
    description: "Open the player-facing authored status collections.",
    action: { type: "open-workspace", feature: "status", workspace: "status" },
  },
];
