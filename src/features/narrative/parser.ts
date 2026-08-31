import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { Interaction } from "./model";

export type ParserMatchReason =
  | "exact-alias"
  | "normalized-alias"
  | "phrase-rule"
  | "verb-object-rule"
  | "known-entity"
  | "fallback";

export type ParserResult = {
  interaction: Interaction | null;
  reason: ParserMatchReason;
  matchedAlias: string | null;
  candidates: string[];
  normalizedInput: string;
};

export function normalizeCommand(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalizeCommand(value).split(" ").filter(Boolean);
}

function candidatesAtCurrentNode(snapshot: ProjectSnapshot, state: PlayState) {
  return snapshot.interactions.filter(
    (interaction) =>
      interaction.sourceNodeId === state.currentNodeId &&
      state.interactionVisibility[interaction.id] !== false,
  );
}

function stableMatches(matches: Array<{ interaction: Interaction; alias: string; score: number }>) {
  return matches.sort(
    (left, right) =>
      right.score - left.score ||
      left.interaction.id.localeCompare(right.interaction.id) ||
      left.alias.localeCompare(right.alias),
  );
}

export function parseCommand(
  input: string,
  snapshot: ProjectSnapshot,
  state: PlayState,
): ParserResult {
  const normalizedInput = normalizeCommand(input);
  const available = candidatesAtCurrentNode(snapshot, state);
  const commandInteractions = available.filter((interaction) => (interaction.matchMode ?? "command") === "command");
  const fallbackInteraction = available
    .filter((interaction) => interaction.matchMode === "fallback")
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  const allAliases = commandInteractions.flatMap((interaction) =>
    interaction.aliases.map((alias) => ({ interaction, alias })),
  );

  const exact = stableMatches(
    allAliases
      .filter(({ alias }) => alias.trim() === input.trim())
      .map(({ interaction, alias }) => ({ interaction, alias, score: alias.length })),
  );
  if (exact[0]) {
    return {
      interaction: exact[0].interaction,
      reason: "exact-alias",
      matchedAlias: exact[0].alias,
      candidates: exact.map(({ interaction }) => interaction.id),
      normalizedInput,
    };
  }

  const normalized = stableMatches(
    allAliases
      .filter(({ alias }) => normalizeCommand(alias) === normalizedInput)
      .map(({ interaction, alias }) => ({ interaction, alias, score: normalizeCommand(alias).length })),
  );
  if (normalized[0]) {
    return {
      interaction: normalized[0].interaction,
      reason: "normalized-alias",
      matchedAlias: normalized[0].alias,
      candidates: normalized.map(({ interaction }) => interaction.id),
      normalizedInput,
    };
  }

  const inputTokens = new Set(tokens(input));
  const phrase = stableMatches(
    allAliases.flatMap(({ interaction, alias }) => {
      const aliasTokens = tokens(alias);
      return aliasTokens.length > 1 && aliasTokens.every((token) => inputTokens.has(token))
        ? [{ interaction, alias, score: aliasTokens.length * 100 + alias.length }]
        : [];
    }),
  );
  if (phrase[0]) {
    return {
      interaction: phrase[0].interaction,
      reason: "phrase-rule",
      matchedAlias: phrase[0].alias,
      candidates: phrase.map(({ interaction }) => interaction.id),
      normalizedInput,
    };
  }

  const inputParts = tokens(input);
  const verbObject = stableMatches(
    allAliases.flatMap(({ interaction, alias }) => {
      const aliasParts = tokens(alias);
      const matches =
        aliasParts.length >= 2 &&
        inputParts.length >= 2 &&
        aliasParts[0] === inputParts[0] &&
        aliasParts.at(-1) === inputParts.at(-1);
      return matches ? [{ interaction, alias, score: aliasParts.length * 10 + alias.length }] : [];
    }),
  );
  if (verbObject[0]) {
    return {
      interaction: verbObject[0].interaction,
      reason: "verb-object-rule",
      matchedAlias: verbObject[0].alias,
      candidates: verbObject.map(({ interaction }) => interaction.id),
      normalizedInput,
    };
  }

  const vocabulary = [
    ...snapshot.items.flatMap((item) => [item.name, ...item.tags]),
    ...snapshot.entities.flatMap((entity) => [entity.name, ...entity.tags]),
    ...snapshot.nodes.flatMap((node) => node.tags),
  ].map(normalizeCommand);
  const mentionsKnownEntity = vocabulary.some(
    (term) => term && (normalizedInput === term || normalizedInput.includes(` ${term}`) || normalizedInput.startsWith(`${term} `)),
  );

  if (fallbackInteraction) {
    return {
      interaction: fallbackInteraction,
      reason: "fallback",
      matchedAlias: null,
      candidates: [fallbackInteraction.id],
      normalizedInput,
    };
  }

  return {
    interaction: null,
    reason: mentionsKnownEntity ? "known-entity" : "fallback",
    matchedAlias: null,
    candidates: [],
    normalizedInput,
  };
}
