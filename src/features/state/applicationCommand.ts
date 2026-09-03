import type { ApplicationCommandCapability } from "../../engine/application/capability";

export const STATE_APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [{
  operation: "state.status.open",
  label: "Status",
  description: "Open the player-visible State groups.",
  action: { type: "open-workspace", feature: "state", workspace: "status" },
}];
