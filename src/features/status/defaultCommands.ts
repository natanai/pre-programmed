import type { CommandDefinition } from "../commands/model";

export const STATUS_STARTER_COMMANDS: readonly CommandDefinition[] = [
  {
    id: "starter-status-open",
    label: "Status",
    operation: "status.open",
    enabled: true,
    patterns: ["status"],
    slots: [],
    targetSlot: "",
  },
];
