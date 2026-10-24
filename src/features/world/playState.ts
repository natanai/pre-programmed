import { pickSeededInitializationValue } from "../../engine/runtime/initializationRandom";
import { selectConditionalCandidate } from "../../engine/rules/conditionalSelection";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { characterAliasCondition, characterAliasName, type EntityDefinition } from "./model";

function uniqueNames(values: readonly string[]) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of values) {
    const name = value.trim();
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Canonical name plus only aliases participating in startup seed selection. */
export function characterNameOptions(character: EntityDefinition) {
  return uniqueNames([
    character.name,
    ...(character.aliases ?? [])
      .filter((alias) => !characterAliasCondition(alias))
      .map(characterAliasName),
  ]);
}

/**
 * World owns the durable result of Character-name initialization. Every name is
 * selected once from the shared Sort seed and then persisted as ordinary play state.
 */
export function initializeWorldPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const characterNames = Object.fromEntries(snapshot.entities
    .filter((entity) => entity.type === "character")
    .map((character) => {
      const options = characterNameOptions(character);
      const selected = pickSeededInitializationValue(
        state.initializationSeed,
        `world.character:${character.id}:name`,
        options,
      ) ?? character.name;
      return [character.id, selected];
    }));
  return { ...state, characterNames };
}

/**
 * Reconciliation never rerolls a running world. Existing selections survive;
 * Characters added after initialization enter the current run under their
 * canonical name and will participate in seeded selection on the next new game.
 */
export function reconcileWorldPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const existing = state.characterNames ?? {};
  const characterNames = Object.fromEntries(snapshot.entities
    .filter((entity) => entity.type === "character")
    .map((character) => [character.id, existing[character.id] || character.name]));
  return { ...state, characterNames };
}

export function resolvedCharacterName(character: EntityDefinition, state: PlayState) {
  return state.characterNames?.[character.id] || character.name;
}

/** Author surfaces always use canonical identity; Play surfaces use this save's resolved identity. */
export function characterNameForPresentation(
  character: EntityDefinition,
  state: PlayState,
  authorMode = false,
  snapshot?: ProjectSnapshot,
) {
  if (authorMode) return character.name;
  const seededName = resolvedCharacterName(character, state);
  if (!snapshot) return seededName;

  // Use Engine Rules\u2019 canonical ordered conditional selector; aliases do not own rule evaluation.
  const conditional = selectConditionalCandidate(
    (character.aliases ?? []).flatMap((alias, order) => {
      const condition = characterAliasCondition(alias);
      const name = characterAliasName(alias).trim();
      return condition && name ? [{ id: `${character.id}:${order}`, order, condition, name }] : [];
    }),
    { snapshot, state },
  );
  return conditional?.name ?? seededName;
}
