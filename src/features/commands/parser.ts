import { semanticReferenceProvider } from "../../engine/references/catalog";
import { normalizePlayerInput } from "../../engine/input/normalize";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { Interaction } from "../narrative/model";
import type { OperationArguments, OperationTarget } from "../operations/model";
import { PLAYER_COMMAND_OPERATION_TARGET_KIND, PLAYER_COMMAND_RESPONSE_OPERATION } from "./operationAdapter";
import type { CommandAction, CommandDefinition } from "./model";

export type ParserMatchReason =
  | "exact-alias"
  | "normalized-alias"
  | "command-grammar"
  | "ambiguous-reference"
  | "capture"
  | "fallback";

export type CommandReferenceAmbiguity = {
  slot: string;
  input: string;
  candidates: Array<{
    sourceKind: string;
    candidateId: string;
    label: string;
  }>;
};

export type CommandInvocation = {
  commandId: string;
  label: string;
  action: CommandAction;
  /** Generic runtime operation transport consumed by the existing App/Operations shell. */
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
  ambiguities: CommandReferenceAmbiguity[];
};

export function normalizeCommand(value: string) {
  return normalizePlayerInput(value);
}

function interactionsAtCurrentNode(snapshot: ProjectSnapshot, state: PlayState) {
  return snapshot.interactions.filter((interaction) => interaction.sourceNodeId === state.currentNodeId);
}

function stableInteractionMatches(matches: Array<{ interaction: Interaction; alias: string; score: number }>) {
  return matches.sort((left, right) =>
    right.score - left.score
    || left.interaction.id.localeCompare(right.interaction.id)
    || left.alias.localeCompare(right.alias));
}

type PatternPart = { type: "literal"; value: string } | { type: "slot"; name: string };
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

function regexEscape(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function literalRegex(value: string) { return value.split(" ").filter(Boolean).map(regexEscape).join("\\s+"); }
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

type ResolvedReference = { sourceKind: string; candidateId: string; label: string; target: OperationTarget };

function referenceMatches(snapshot: ProjectSnapshot, state: PlayState, sourceKinds: readonly string[], captured: string): ResolvedReference[] {
  const normalizedCapture = normalizeCommand(captured);
  return sourceKinds.flatMap((sourceKind) => {
    const sourceSetting = snapshot.settings.commands.referenceSources.find((setting) => setting.sourceKind === sourceKind && setting.enabled);
    const provider = semanticReferenceProvider(sourceKind);
    if (!sourceSetting || !provider?.targetable) return [];
    return provider.candidates({ snapshot, state }).flatMap((candidate) => {
      if (!candidate.target) return [];
      const defaults = sourceSetting.includeDefaults ? [candidate.key, ...candidate.aliases] : [];
      const aliases = [...defaults, ...(sourceSetting.aliases[candidate.id] ?? [])].map(normalizeCommand).filter(Boolean);
      return aliases.includes(normalizedCapture)
        ? [{ sourceKind, candidateId: candidate.id, label: candidate.label, target: candidate.target }]
        : [];
    });
  }).sort((left, right) => left.sourceKind.localeCompare(right.sourceKind) || left.candidateId.localeCompare(right.candidateId));
}

function sameResolvedReference(left: ResolvedReference, right: ResolvedReference) {
  return left.sourceKind === right.sourceKind && left.candidateId === right.candidateId
    && left.target.kind === right.target.kind && left.target.id === right.target.id;
}
function distinctReferences(matches: ResolvedReference[]) {
  return matches.filter((match, index) => !matches.slice(0, index).some((existing) => sameResolvedReference(existing, match)));
}

type CommandPatternMatch = {
  command: CommandDefinition;
  pattern: string;
  score: number;
  invocation: CommandInvocation | null;
  ambiguities: CommandReferenceAmbiguity[];
};

function matchCommandPattern(command: CommandDefinition, pattern: string, input: string, snapshot: ProjectSnapshot, state: PlayState): CommandPatternMatch | null {
  const parts = parsePattern(pattern);
  const compiled = patternRegex(parts);
  if (!compiled) return null;
  const match = compiled.regex.exec(input);
  if (!match) return null;

  const args: OperationArguments = {};
  const ambiguities: CommandReferenceAmbiguity[] = [];
  let captureIndex = 1;
  for (const slotName of compiled.captures) {
    const captured = match[captureIndex++]?.trim() ?? "";
    if (!captured) return null;
    const slot = command.slots.find((candidate) => candidate.name === slotName);
    const sourceKinds = slot?.sourceKinds ?? [];
    if (!sourceKinds.length) {
      args[slotName] = { kind: "text", value: captured };
      continue;
    }
    const matches = distinctReferences(referenceMatches(snapshot, state, sourceKinds, captured));
    if (!matches.length) return null;
    if (matches.length > 1) {
      ambiguities.push({ slot: slotName, input: captured, candidates: matches.map(({ sourceKind, candidateId, label }) => ({ sourceKind, candidateId, label })) });
      continue;
    }
    const reference = matches[0];
    args[slotName] = { kind: "target", sourceKind: reference.sourceKind, candidateId: reference.candidateId, label: reference.label, target: reference.target };
  }

  const targetSlot = command.action.type === "target-operation" ? command.action.targetSlot : "";
  const targetArgument = targetSlot ? args[targetSlot] : undefined;
  if (!ambiguities.length && targetSlot && (!targetArgument || targetArgument.kind !== "target")) return null;
  const operation = command.action.type === "response" ? PLAYER_COMMAND_RESPONSE_OPERATION : command.action.operation;
  const target = command.action.type === "response"
    ? { kind: PLAYER_COMMAND_OPERATION_TARGET_KIND, id: command.id }
    : targetArgument?.kind === "target" ? targetArgument.target : null;

  return {
    command,
    pattern,
    score: commandSpecificity(parts),
    ambiguities,
    invocation: ambiguities.length ? null : {
      commandId: command.id,
      label: command.label,
      action: command.action,
      operation,
      pattern,
      arguments: args,
      target,
    },
  };
}

function projectGrammarMatches(input: string, snapshot: ProjectSnapshot, state: PlayState) {
  return snapshot.settings.commands.commands
    .filter((command) => command.enabled)
    .flatMap((command) => command.patterns.flatMap((pattern) => {
      const match = matchCommandPattern(command, pattern, input, snapshot, state);
      return match ? [match] : [];
    }))
    .sort((left, right) => right.score - left.score || left.command.id.localeCompare(right.command.id) || left.pattern.localeCompare(right.pattern));
}

export function parseCommand(input: string, snapshot: ProjectSnapshot, state: PlayState): ParserResult {
  const normalizedInput = normalizeCommand(input);
  const sceneInteractions = interactionsAtCurrentNode(snapshot, state);
  const commandInteractions = sceneInteractions.filter((interaction) => (interaction.matchMode ?? "command") === "command");
  const captureInteraction = sceneInteractions.filter((interaction) => interaction.matchMode === "capture").sort((left, right) => left.id.localeCompare(right.id))[0];
  const fallbackInteraction = sceneInteractions.filter((interaction) => interaction.matchMode === "fallback").sort((left, right) => left.id.localeCompare(right.id))[0];
  const allAliases = commandInteractions.flatMap((interaction) => interaction.aliases.map((alias) => ({ interaction, alias })));

  const exact = stableInteractionMatches(allAliases.filter(({ alias }) => alias.trim() === input.trim()).map(({ interaction, alias }) => ({ interaction, alias, score: alias.length })));
  if (exact[0]) return { interaction: exact[0].interaction, invocation: null, reason: "exact-alias", matchedAlias: exact[0].alias, matchedPattern: null, candidates: exact.map(({ interaction }) => interaction.id), normalizedInput, ambiguities: [] };

  const normalized = stableInteractionMatches(allAliases.filter(({ alias }) => normalizeCommand(alias) === normalizedInput).map(({ interaction, alias }) => ({ interaction, alias, score: normalizeCommand(alias).length })));
  if (normalized[0]) return { interaction: normalized[0].interaction, invocation: null, reason: "normalized-alias", matchedAlias: normalized[0].alias, matchedPattern: null, candidates: normalized.map(({ interaction }) => interaction.id), normalizedInput, ambiguities: [] };

  const grammarMatches = projectGrammarMatches(normalizedInput, snapshot, state);
  const strongest = grammarMatches[0];
  if (strongest?.ambiguities.length) return {
    interaction: fallbackInteraction ?? null,
    invocation: null,
    reason: "ambiguous-reference",
    matchedAlias: null,
    matchedPattern: strongest.pattern,
    candidates: [...new Set(grammarMatches.filter((entry) => entry.score === strongest.score).map(({ command }) => command.id))],
    normalizedInput,
    ambiguities: strongest.ambiguities,
  };
  if (strongest?.invocation) return {
    interaction: null,
    invocation: strongest.invocation,
    reason: "command-grammar",
    matchedAlias: null,
    matchedPattern: strongest.pattern,
    candidates: [...new Set(grammarMatches.filter((entry) => entry.score === strongest.score).map(({ command }) => command.id))],
    normalizedInput,
    ambiguities: [],
  };

  if (captureInteraction) return { interaction: captureInteraction, invocation: null, reason: "capture", matchedAlias: null, matchedPattern: null, candidates: [captureInteraction.id], normalizedInput, ambiguities: [] };
  if (fallbackInteraction) return { interaction: fallbackInteraction, invocation: null, reason: "fallback", matchedAlias: null, matchedPattern: null, candidates: [fallbackInteraction.id], normalizedInput, ambiguities: [] };
  return { interaction: null, invocation: null, reason: "fallback", matchedAlias: null, matchedPattern: null, candidates: [], normalizedInput, ambiguities: [] };
}
