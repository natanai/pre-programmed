import type { AuthorOperationDefinition } from "../operations/targetAdapter";

export const EQUIPMENT_OPERATION_DEFINITIONS: readonly AuthorOperationDefinition[] = [
  { value: "equip", label: "equip", targetKinds: ["inventory.item"] },
  { value: "unequip", label: "unequip", targetKinds: ["inventory.item"] },
];
