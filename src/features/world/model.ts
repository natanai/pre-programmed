import type { OperationHook, OperationId } from "../operations/model";

export type EntityDefinition = {
  id: string;
  key: string;
  type: "character" | "location";
  /** Canonical Author-facing identity. Play may resolve a Character alias for one save. */
  name: string;
  /** Alternate names eligible for seeded Character-name resolution at new-world initialization. */
  aliases?: string[];
  description: string;
  tags: string[];
  /** Stable Media image reference used as this Character's portrait. Locations leave this unset. */
  portraitAssetId?: string | null;
  /** Optional until the World operation persistence/Author slice activates it. */
  interactable?: boolean;
  operations?: OperationId[];
  hooks?: OperationHook[];
};
