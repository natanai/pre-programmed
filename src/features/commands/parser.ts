import { APPLICATION_COMMAND_CAPABILITIES } from "../../engine/application/catalog";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { normalizePlayerInput } from "../../engine/input/normalize";
import type { Interaction } from "../narrative/model";
import type { OperationArguments, OperationTarget } from "../operations/model";
import type { CommandDefinition } from "./model";
import { commandReferenceSourceByKind } from "./referenceCatalog";

export type ParserMatchReason =
  | "exact-alias"
  | "normalized-alias"
  | "command-grammar"
  | "fallback";

export type CommandInvocation = {
  commandId: string;
  label: string;
  operation: string;
  pattern: string;
  arguments: OperationArguments;
  target: OperationTarget | null;
};

export type ParserResult = {
  interaction: Interaction | null;
  invocation: CommandInvocation | null;
  reason: ParserMatchReason;
  matchedAlias: string | null;
  matchedPattern: string | null;
  candidates: string[];
  normalizedInput: string;
};

export function normalizeCommand(value: string) {
  return normalizePlayerInput(value);
}

function candidatesAtCurrentNode(snapshot: ProjectSnapshot, state: PlayState) {
  return snapshot.interactions.filter(
    (interaction) =>
      interaction.sourceNodeId === state.currentNodeId &&
      state.interactionVisibility[interaction.id] !== false,
  );
}

function stableInteractionMatches(matches: Array<{ interaction: Interaction; alias: string; score: number }>) {
  return matches.sort(
    (left, right) =>
      right.score - left.score ||
      left.interaction.id.localeCompare(right.interaction.id) ||
      left.alias.localeCompare(right.alias),
  );
}

type PatternPart =
  | { type: "literal"; value: string }
  | { type: "slot"; name: string };

const PLACEHOLDER_PATTERN = /\{([a-z][a-z0-9_-]*)\}/gi;

function parsePattern(pattern: string) {
  const parts: PatternPart[] = [];
  let cursor = 0;
  for (const match of pattern.matchAll(PLACEHOLDER_PATTERN)) {
    const index = match.index ?? 0;
    const literal = normalizeCommand(pattern.slice(cursor, index));
    if (literal) parts.push({ type: "literal", value: literal });
    parts.push({ type: "slot", name: match[1].toLowerCase() });
    cursor = index + match[0].length;
  }
  const tail = normalizeCommand(pattern.slice(cursor));
  if (tail) parts.push({ type: "literal", value: tail });
  return parts;
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function literalRegex(value: string) {
  return value.split(" ").filter(Boolean).map(regexEscape).join("\\s+");
}

function patternRegex(parts: PatternPart[]) {
  if (!parts.length) return null;
  const captures: string[] = [];
  const body = parts.map((part) => {
    if (part.type === "literal") return literalRegex(part.value);
    captures.push(part.name);
    return "(.+?)";
  }).join("\\s+");
  return { regex: new RegExp(`^${body}$`, "u"), captures };
}

function commandSpecificity(parts: PatternPart[]) {
  const literals = parts.filter((part): part is Extract<PatternPart, { type: "literal" }> => part.type === "literal");
  const slots = parts.filter((part) => part.type === "slot").length;
  const words = literals.reduce((total, part) => total + part.value.split(" ").filter(Boolean).length, 0);
  const characters = literals.reduce((total, part) => total + part.value.length, 0);
  return words * 1000 + characters * 10 - slots;
}

function referenceArgument(
  snapshot: ProjectSnapshot,
  state: PlayState,
  sourceKind: string,
  captured: string,
) {
  const sourceSetting = snapshot.settings.commands.referenceSources.find(
    (setting) => setting.sourceKind === sourceKind && setting.enabled,
  );
  const source = commandReferenceSourceByKind(sourceKind);
  if (!sourceSetting || !source) return null;

  const normalizedCapture = normalizeCommand(captured);
  const matches = source.candidates(snapshot, state).flatMap((candidate) => {
    const defaults = sourceSetting.includeDefaults ? candidate.aliases : [];
    const aliases = [...defaults, ...(sourceSetting.aliases[candidate.id] ?? [])]
      .map(normalizeCommand)
      .filter(Boolean);
    return aliases.includes(normalizedCapture) ? [candidate] : [];
  }).sort((left, right) => left.id.localeCompare(right.id));

  const candidate = matches[0];
  if (!candidate) return null;
  return {
    kind: "target" as const,
    sourceKind,
    candidateId: candidate.id,
    label: candidate.label,
    target: candidate.target,
  };
}

function matchCommandPattern(
  command: CommandDefinition,
  pattern: string,
  input: string,
  snapshot: ProjectSnapshot,
  state: PlayState,
) {
  const parts = parsePattern(pattern);
  const compiled = patternRegex(parts);
  if (!compiled) return null;
  const match = compiled.regex.exec(input);
  if (!match) return null;

  const args: OperationArguments = {};
  let captureIndex = 1;
  for (const slotName of compiled.captures) {
    const captured = match[captureIndex++]?.trim() ?? "";
    if (!captured) return null;
    const slot = command.slots.find((candidate) => candidate.name === slotName);
    const sourceKind = slot?.sourceKind ?? "text";
    if (sourceKind === "text") {
      args[slotName] = { kind: "text", value: captured };
      continue;
    }
    const reference = referenceArgument(snapshot, state, sourceKind, captured);
    if (!reference) return null;
    args[slotName] = reference;
  }

  const targetArgument = command.targetSlot ? args[command.targetSlot] : undefined;
  if (command.targetSlot && (!targetArgument || targetArgument.kind !== "target")) return null;

  return {
    invocation: {
      commandId: command.id,
      label: command.label,
      operation: command.operation,
      pattern,
      arguments: args,
      target: targetArgument?.kind === "target" ? targetArgument.target : null,
    } satisfies CommandInvocation,
    score: commandSpecificity(parts),
  };
}

function projectGrammarMatches(input: string, snapshot: ProjectSnapshot, state: PlayState) {
  return snapshot.settings.commands.commands
    .filter((command) => command.enabled)
    .flatMap((command) => command.patterns.flatMap((pattern) => {
      const match = matchCommandPattern(command, pattern, input, snapshot, state);
      return match ? [{ command, pattern, ...match }] : [];
    }))
    .sort((left, right) =>
      right.score - left.score ||
      left.command.id.localeCompare(right.command.id) ||
      left.pattern.localeCompare(right.pattern));
}

function systemApplicationCommandMatches(input: string) {
  return APPLICATION_COMMAND_CAPABILITIES.flatMap((capability) =>
    (capability.systemPatterns ?? []).flatMap((pattern) =>
      normalizeCommand(pattern) === input ? [{ capability, pattern }] : []),
  ).sort((left, right) =>
    right.pattern.length - left.pattern.length
    || left.capability.operation.localeCompare(right.capability.operation));
}

/**
 * Parse player text without built-in adventure-game vocabulary.
 *
 * Precedence is deliberately explicit:
 * 1. installed system application commands,
 * 2. current-scene authored aliases,
 * 3. project-wide authored command grammar,
 * 4. current-scene authored fallback.
 *
 * System application commands are reserved engine/application operations such
 * as portable save/load, not hidden adventure-game verb heuristics.
 */
export function parseCommand(
  input: string,
  snapshot: ProjectSnapshot,
  state: PlayState,
): ParserResult {
  const normalizedInput = normalizeCommand(input);
  const systemMatches = systemApplicationCommandMatches(normalizedInput);
  if (systemMatches[0]) {
    const match = systemMatches[0];
    return {
      interaction: null,
      invocation: {
        commandId: `application:${match.capability.operation}`,
        label: match.capability.label,
        operation: match.capability.operation,
        pattern: match.pattern,
        arguments: {},
        target: null,
      },
      reason: "command-grammar",
      matchedAlias: null,
      matchedPattern: match.pattern,
      candidates: [...new Set(systemMatches.map(({ capability }) => `application:${capability.operation}`))],
      normalizedInput,
    };
  }

  const available = candidatesAtCurrentNode(snapshot, state);
  const commandInteractions = available.filter((interaction) => (interaction.matchMode ?? "command") === "command");
  const fallbackInteraction = available
    .filter((interaction) => interaction.matchMode === "fallback")
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  const allAliases = commandInteractions.flatMap((interaction) =>
    interaction.aliases.map((alias) => ({ interaction, alias })),
  );

  const exact = stableInteractionMatches(
    allAliases
      .filter(({ alias }) => alias.trim() === input.trim())
      .map(({ interaction, alias }) => ({ interaction, alias, score: alias.length })),
  );
  if (exact[0]) {
    return {
      interaction: exact[0].interaction,
      invocation: null,
      reason: "exact-alias",
      matchedAlias: exact[0].alias,
      matchedPattern: null,
      candidates: exact.map(({ interaction }) => interaction.id),
      normalizedInput,
    };
  }

  const normalized = stableInteractionMatches(
    allAliases
      .filter(({ alias }) => normalizeCommand(alias) === normalizedInput)
      .map(({ interaction, alias }) => ({ interaction, alias, score: normalizeCommand(alias).length })),
  );
  if (normalized[0]) {
    return {
      interaction: normalized[0].interaction,
      invocation: null,
      reason: "normalized-alias",
      matchedAlias: normalized[0].alias,
      matchedPattern: null,
      candidates: normalized.map(({ interaction }) => interaction.id),
      normalizedInput,
    };
  }

  const grammarMatches = projectGrammarMatches(normalizedInput, snapshot, state);
  if (grammarMatches[0]) {
    return {
      interaction: null,
      invocation: grammarMatches[0].invocation,
      reason: "command-grammar",
      matchedAlias: null,
      matchedPattern: grammarMatches[0].pattern,
      candidates: [...new Set(grammarMatches.map(({ command }) => command.id))],
      normalizedInput,
    };
  }

  if (fallbackInteraction) {
    return {
      interaction: fallbackInteraction,
      invocation: null,
      reason: "fallback",
      matchedAlias: null,
      matchedPattern: null,
      candidates: [fallbackInteraction.id],
      normalizedInput,
    };
  }

  return {
    interaction: null,
    invocation: null,
    reason: "fallback",
    matchedAlias: null,
    matchedPattern: null,
    candidates: [],
    normalizedInput,
  };
}
