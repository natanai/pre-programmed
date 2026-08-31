import type { CommandDefinition } from "../commands/model";

/**
 * Starter-project grammar replacing the prototype App-level inventory shortcut.
 * These words are ordinary editable project data: authors may rename, extend,
 * disable, or delete this command without changing engine code.
 */
export const INVENTORY_STARTER_COMMANDS: readonly CommandDefinition[] = [
  {
    id: "starter-inventory-open",
    label: "Inventory",
    operation: "inventory.open",
    enabled: true,
    patterns: ["inventory", "inv"],
    slots: [],
    targetSlot: "",
  },
];
