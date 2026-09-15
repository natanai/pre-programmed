import { pickSeededInitializationValue } from "../../engine/runtime/initializationRandom";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { EntityDefinition } from "./model";

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

/** Canonical name plus the author's alternate-name pool for this Character. */
export function characterNameOptions(character: EntityDefinition) {
  return uniqueNames([character.name, ...(character.aliases ?? [])]);
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
) {
  return authorMode ? character.name : resolvedCharacterName(character, state);
}
