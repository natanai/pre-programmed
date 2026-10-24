import type { OperationHook, OperationId } from "../operations/model";
import type { Condition } from "../../engine/rules/model";
import type { ConditionalSelectionMode } from "../../engine/rules/conditionalSelection";

/** A reusable alternate name. Its optional When condition affects display, not identity. */
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
  /** Alternate names remain usable for references even when not shown as the primary name. */
  aliases?: CharacterAlias[];
  /**
   * Shared first/random selection at world initialization: first keeps the canonical name,
   * random selects from canonical plus unconditional aliases using the shared world seed.
   * Older projects omitted this field and implicitly used random; keep that compatibility.
   */
  startingNameSelection?: ConditionalSelectionMode;
  description: string;
  tags: string[];
  /** Stable Media image reference used as this Character's portrait. Locations leave this unset. */
  portraitAssetId?: string | null;
  /** Optional until the World operation persistence/Author slice activates it. */
  interactable?: boolean;
  operations?: OperationId[];
  hooks?: OperationHook[];
};

/** The single read boundary for older Characters that implicitly seeded their aliases. */
export function characterStartingNameSelection(character: EntityDefinition): ConditionalSelectionMode {
  if (character.startingNameSelection) return character.startingNameSelection;
  // No eligible aliases means either mode resolves to the canonical name.
  // Treat it as first so an imported alias-less Character is intuitive to edit.
  return (character.aliases ?? []).some((alias) => !characterAliasCondition(alias)) ? "random" : "first";
}
