import type { BodyTypeDefinition, EquipmentRuleDefinition } from "./model";

export type EquipmentProjectSlice = {
  bodyTypes: BodyTypeDefinition[];
  equipmentRules: EquipmentRuleDefinition[];
  startingBodyTypeId: string | null;
};

export type EquipmentPlayStateSlice = {
  activeBodyTypeId: string | null;
  equipmentAssignments: Record<string, string>;
};
