import { characterAliasCondition, characterAliasName, type CharacterAlias, type EntityDefinition } from "../model";

export function normalizedAliases(entity: EntityDefinition): CharacterAlias[] {
  const canonical = entity.name.trim().toLocaleLowerCase();
  const seen = new Set<string>();
  return (entity.aliases ?? []).flatMap((alias) => {
    const name = characterAliasName(alias).trim();
    const key = name.toLocaleLowerCase();
    if (!name || key === canonical || seen.has(key)) return [];
    seen.add(key);
    const condition = characterAliasCondition(alias);
    return [{ name, ...(condition ? { condition } : {}) }];
  });
}

/** Keep the exact in-progress textarea value; stripping blank lines here prevented Space and Enter. */
export function aliasesFromInput(value: string, previous: readonly CharacterAlias[]): CharacterAlias[] {
  const names = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const remaining = new Set(names.map((name) => name.toLocaleLowerCase()));
  const taken = new Set<number>();
  return names.map((name, index) => {
    const matching = previous.findIndex((alias, oldIndex) =>
      !taken.has(oldIndex) && characterAliasName(alias).toLocaleLowerCase() === name.toLocaleLowerCase());
    // A changed name retains its rule, but inserting a new row cannot steal a later row's rule.
    const oldIndex = matching >= 0 ? matching
      : index < previous.length && !taken.has(index)
        && !remaining.has(characterAliasName(previous[index]).toLocaleLowerCase()) ? index : -1;
    if (oldIndex >= 0) taken.add(oldIndex);
    const condition = oldIndex >= 0 ? characterAliasCondition(previous[oldIndex]) : undefined;
    return { name, ...(condition ? { condition } : {}) };
  });
}

