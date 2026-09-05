import type { CommandDefinition } from "../commands/model";

/** Starter grammar for the State-owned player presentation surface. */
export const STATE_STARTER_COMMANDS: readonly CommandDefinition[] = [{
  id: "starter-state-status-open",
  label: "Status",
  enabled: true,
  patterns: ["status", "stats"],
  slots: [],
  action: { type: "application", operation: "state.status.open" },
}];
