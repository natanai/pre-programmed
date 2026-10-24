import type { EntityDefinition } from "../model";
import { characterAliasName, characterStartingNameSelection } from "../model";

/** Canonical World Author draft. Used by the one Character/Location editor. */
export type EntityDraft = EntityDefinition & { aliasesInput?: string };

export function newEntity(type: EntityDefinition["type"]): EntityDraft {
  return {
    id: crypto.randomUUID(),
    key: "",
    type,
    name: "",
    aliases: [],
    startingNameSelection: "first",
    description: "",
    tags: [],
    portraitAssetId: null,
    interactable: false,
    operations: [],
    hooks: [],
  };
}

/**
 * Imported Characters may contain older string aliases and no selection flag.
 * Preserve random draws for existing sets of aliases; an alias-less Character
 * keeps the canonical name if the author later adds their first nickname.
 * Only this editor owns the draft and its durable save.
 */
export function entityAuthorDraft(entity: EntityDefinition): EntityDraft {
  const source = structuredClone(entity);
  return {
    ...source,
    ...(source.type === "character" ? {
      startingNameSelection: characterStartingNameSelection(source),
    } : {}),
    aliasesInput: (source.aliases ?? []).map(characterAliasName).join("\n"),
  };
}
