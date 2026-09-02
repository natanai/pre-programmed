import type { ApplicationCommandCapability } from "../../engine/application/capability";

export const EQUIPMENT_APPLICATION_COMMAND_CAPABILITIES: readonly ApplicationCommandCapability[] = [{
  operation: "equipment.open",
  label: "Open Equipment",
  description: "Open the active body and equipment slots.",
  action: { type: "open-workspace", feature: "equipment", workspace: "equipment" },
}];
