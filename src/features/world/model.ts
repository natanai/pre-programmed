import type { OperationHook, OperationId } from "../operations/model";

export type EntityDefinition = {
  id: string;
  key: string;
  type: "character" | "location";
  name: string;
  description: string;
  tags: string[];
  /** Stable Media image reference used as this Character's portrait. Locations leave this unset. */
  portraitAssetId?: string | null;
  /** Optional until the World operation persistence/Author slice activates it. */
  interactable?: boolean;
  operations?: OperationId[];
  hooks?: OperationHook[];
};
