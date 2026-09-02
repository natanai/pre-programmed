import type { BodyTypeDefinition, EquipmentRuleDefinition } from "./model";

export type EquipmentMutationOperation =
  | { type: "bodyType.upsert"; bodyType: BodyTypeDefinition }
  | { type: "bodyType.delete"; id: string }
  | { type: "bodyType.starting"; id: string | null }
  | { type: "equipmentRule.upsert"; rule: EquipmentRuleDefinition };
