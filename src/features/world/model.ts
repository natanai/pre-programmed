import type { OperationHook, OperationId } from "../operations/model";
import type { Condition } from "../../engine/rules/model";

/** A name candidate: no condition joins the world-seeded pool; a condition overrides it while matching. */
export type CharacterAlias = string | { name: string; condition?: Condition };

export function characterAliasName(alias: CharacterAlias): string {
  return typeof alias === "string" ? alias : alias.name;
}

export function characterAliasCondition(alias: CharacterAlias): Condition | undefined {
  return typeof alias === "string" ? undefined : alias.condition;
}

export type EntityDefinition = {
  id: string;
  key: string;
  type: "character" | "location";
  /** Canonical Author-facing identity. Play may resolve a Character alias for one save. */
  name: string;
  /** Names seeded at game start or conditionally presented during play. Legacy strings are seeded names. */
  aliases?: CharacterAlias[];
  description: string;
  tags: string[];
  /** Stable Media image reference used as this Character's portrait. Locations leave this unset. */
  portraitAssetId?: string | null;
  /** Optional until the World operation persistence/Author slice activates it. */
  interactable?: boolean;
  operations?: OperationId[];
  hooks?: OperationHook[];
};
