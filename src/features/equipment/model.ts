export type EquipmentSlotDefinition = {
  id: string;
  key: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StartingEquipmentDefinition = { slotKey: string; itemId: string };

export type BodyTypeDefinition = {
  id: string;
  name: string;
  assetId: string;
  slots: EquipmentSlotDefinition[];
  startingEquipment: StartingEquipmentDefinition[];
};

export type EquipmentRuleDefinition = {
  itemId: string;
  slotKeys: string[];
  storage: "inventory" | "slot";
  equipOnGiveSlotKey: string | null;
};
