import type { EntityDefinition } from "../model";
import { characterAliasName, characterStartingNameSelection } from "../model";
import { makeSemanticReferenceToken } from "../../../engine/references/runtime";
import { ALWAYS } from "../../../engine/rules/model";

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

/** A context-provided shortcut that drafts the ordinary Character alias in its
 * one canonical editor. It does not save until the Character task is saved. */
export function appendCapturedTextAlias(draft: EntityDraft, variableId: string): EntityDraft {
  if (draft.type !== "character" || !variableId) return draft;
  const name = makeSemanticReferenceToken("state.variable", variableId, "value");
  if ((draft.aliases ?? []).some((alias) => characterAliasName(alias) === name)) return draft;
  return {
    ...draft,
    aliases: [...(draft.aliases ?? []), { name, condition: ALWAYS }],
    aliasesInput: [...(draft.aliases ?? []).map(characterAliasName), name].join("\n"),
  };
}
