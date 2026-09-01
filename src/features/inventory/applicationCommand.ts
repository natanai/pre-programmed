import type { ApplicationCommandCapability } from "../../engine/application/capability";

export const INVENTORY_APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [
  {
    operation: "inventory.open",
    label: "Open Inventory",
    description: "Open the player's inventory workspace.",
    action: { type: "open-workspace", feature: "inventory", workspace: "inventory" },
  },
];
