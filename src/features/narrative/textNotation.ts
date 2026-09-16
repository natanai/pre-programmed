import { inlineTextCommandAt } from "../../engine/presentation/inlineTextCommandCatalog";
import type { TextCue, TextPerformance } from "./model";

export type CompiledTextPerformance = {
  text: string;
  performance: TextPerformance;
};

type ScopeCode = "l" | "f" | "s" | "h" | "w" | "b" | "i" | "shake" | "speed" | "opacity" | "color" | "disappear";

type OpenScope = {
  code: ScopeCode;
  outputStart: number;
  rawStart: number;
  value?: TextCue["value"];
};

type ScopeHead = {
  code: ScopeCode;
  rawLength: number;
  value?: TextCue["value"];
};

const DEFAULT_PAUSE_MS = 350;
const MAX_DISAPPEAR_SECONDS = 3600;

export type TextNotationIssue = {
  index: number;
  message: string;
};

function commandHeadAt(rawText: string, index: number) {
  return rawText.slice(index).match(/^\/([a-z][a-z0-9-]*)\{/i);
}

function normalizeHexColor(value: string) {
  const raw = value.startsWith("#") ? value.slice(1) : value;
  return `#${raw.toUpperCase()}`;
}

/** One parser owns the core scoped-text command grammar for both validation and compilation. */
function scopeHeadAt(rawText: string, index: number): ScopeHead | null {
  const source = rawText.slice(index);
  const shake = source.match(/^\/shake\{/);
  if (shake) return { code: "shake", rawLength: shake[0].length };

  const speed = source.match(/^\/speed(\d{1,3})\{/);
  if (speed) return { code: "speed", rawLength: speed[0].length, value: Number(speed[1]) };

  const opacity = source.match(/^\/opacity(\d{1,3})\{/);
  if (opacity) return { code: "opacity", rawLength: opacity[0].length, value: Number(opacity[1]) };

  const disappear = source.match(/^\/disappear(\d{1,4}(?:\.\d{1,3})?)\{/);
  if (disappear) return { code: "disappear", rawLength: disappear[0].length, value: Number(disappear[1]) };

  const color = source.match(/^\/color(#?[0-9a-f]{3}(?:[0-9a-f]{3})?)\{/i);
  if (color) return { code: "color", rawLength: color[0].length, value: normalizeHexColor(color[1]) };

  const short = source.match(/^\/([lfshwbi])\{/);
  if (short) return { code: short[1] as ScopeCode, rawLength: short[0].length };
  return null;
}

function parameterScopeSyntaxIssue(rawText: string, index: number): string | null {
  const malformed = rawText.slice(index).match(/^\/(speed|opacity|disappear|color)([^{}]*)\{/i);
  if (!malformed) return null;
  switch (malformed[1].toLowerCase()) {
    case "speed": return "Speed must be an integer from 1 to 120, for example /speed30{text}.";
    case "opacity": return "Opacity must be an integer from 0 to 100, for example /opacity50{text}.";
    case "disappear": return `Disappear time must be between 0 and ${MAX_DISAPPEAR_SECONDS} seconds, for example /disappear3{text}.`;
    case "color": return "Color must be a 3- or 6-digit HEX value, for example /color#FF8800{text}.";
    default: return null;
  }
}

/** Validate authored inline notation before it reaches the player. */
export function validateTextNotation(rawText: string): TextNotationIssue[] {
  const issues: TextNotationIssue[] = [];
  const scopes: Array<{ index: number; code: ScopeCode }> = [];

  for (let index = 0; index < rawText.length; index += 1) {
    if (rawText.startsWith("//", index)) {
      index += 1;
      continue;
    }

    const scope = scopeHeadAt(rawText, index);
    if (scope) {
      if (scope.code === "speed" && (Number(scope.value) < 1 || Number(scope.value) > 120)) {
        issues.push({ index, message: `Inline speed at character ${index + 1} must be between 1 and 120.` });
      }
      if (scope.code === "opacity" && (Number(scope.value) < 0 || Number(scope.value) > 100)) {
        issues.push({ index, message: `Inline opacity at character ${index + 1} must be between 0 and 100.` });
      }
      if (scope.code === "disappear" && (Number(scope.value) < 0 || Number(scope.value) > MAX_DISAPPEAR_SECONDS)) {
        issues.push({ index, message: `Disappear time at character ${index + 1} must be between 0 and ${MAX_DISAPPEAR_SECONDS} seconds.` });
      }
      scopes.push({ index, code: scope.code });
      index += scope.rawLength - 1;
      continue;
    }

    const parameterIssue = parameterScopeSyntaxIssue(rawText, index);
    if (parameterIssue) {
      issues.push({ index, message: `${parameterIssue} Character ${index + 1}.` });
      const close = rawText.indexOf("}", index + 1);
      if (close < 0) break;
      index = close;
      continue;
    }

    const command = inlineTextCommandAt(rawText, index);
    if (command) {
      if (!command.closed) {
        issues.push({ index, message: `/${command.definition.code}{...} at character ${index + 1} needs a closing }.` });
        break;
      }
      if (command.definition.valueRequired && !command.value.trim()) {
        issues.push({ index, message: `Choose a value for /${command.definition.code}{...} at character ${index + 1}.` });
      }
      index = command.rawEnd - 1;
      continue;
    }

    const unknownCommand = commandHeadAt(rawText, index);
    if (unknownCommand) {
      issues.push({ index, message: `Unknown inline command /${unknownCommand[1]}{...} at character ${index + 1}.` });
      const close = rawText.indexOf("}", index + unknownCommand[0].length);
      if (close < 0) {
        issues.push({ index, message: `Inline command opened at character ${index + 1} needs a closing }.` });
        break;
      }
      index = close;
      continue;
    }

    if (rawText[index] === "}" && scopes.length) scopes.pop();
  }

  for (const scope of scopes) {
    issues.push({ index: scope.index, message: `Text rule opened at character ${scope.index + 1} needs a closing }.` });
  }
  return issues.sort((left, right) => left.index - right.index);
}

function clampSpeed(value: number) {
  return Math.max(1, Math.min(120, Math.round(value)));
}

function clampOpacity(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampDisappearSeconds(value: number) {
  return Math.max(0, Math.min(MAX_DISAPPEAR_SECONDS, value));
}

function generatedCue(id: string, type: TextCue["type"], start: number, end: number, value?: TextCue["value"]): TextCue {
  return { id, type, start, end, ...(value === undefined ? {} : { value }) };
}

function scopeCues(scope: OpenScope, end: number, baseSpeed: number, sequence: number): TextCue[] {
  if (end <= scope.outputStart) return [];
  const id = (suffix: string) => `inline:${scope.code}:${scope.rawStart}:${end}:${sequence}:${suffix}`;
  switch (scope.code) {
    case "l":
      return [generatedCue(id("speed"), "speed", scope.outputStart, end, clampSpeed(baseSpeed * .55))];
    case "f":
      return [generatedCue(id("speed"), "speed", scope.outputStart, end, clampSpeed(baseSpeed * 2))];
    case "s":
      return [
        generatedCue(id("speed"), "speed", scope.outputStart, end, clampSpeed(baseSpeed * 1.35)),
        generatedCue(id("shake"), "shake", scope.outputStart, end),
      ];
    case "h":
      return [
        generatedCue(id("instant"), "instant", scope.outputStart, end),
        generatedCue(id("shake"), "shake", scope.outputStart, end),
      ];
    case "w":
      return [generatedCue(id("wave"), "wave", scope.outputStart, end)];
    case "b":
      return [generatedCue(id("blink"), "blink", scope.outputStart, end)];
    case "i":
      return [generatedCue(id("instant"), "instant", scope.outputStart, end)];
    case "shake":
      return [generatedCue(id("shake"), "shake", scope.outputStart, end)];
    case "speed":
      return [generatedCue(id("speed"), "speed", scope.outputStart, end, clampSpeed(Number(scope.value ?? baseSpeed)))];
    case "opacity":
      return [generatedCue(id("opacity"), "opacity", scope.outputStart, end, clampOpacity(Number(scope.value ?? 100)))];
    case "color":
      return [generatedCue(id("color"), "color", scope.outputStart, end, normalizeHexColor(String(scope.value ?? "#FFFFFF")))];
    case "disappear":
      return [generatedCue(id("disappear"), "disappear", scope.outputStart, end, clampDisappearSeconds(Number(scope.value ?? 0)))];
  }
}

/**
 * Compile slash notation embedded in authored prose into the runtime cue model.
 * The authored source string is the canonical presentation source: control
 * notation is removed from player-facing copy and no separately positioned
 * Author timeline is composed back in.
 */
export function compileTextNotation(rawText: string, performance: TextPerformance): CompiledTextPerformance {
  const output: string[] = [];
  const scopes: OpenScope[] = [];
  const inlineCues: TextCue[] = [];
  let cueSequence = 0;
  let index = 0;

  while (index < rawText.length) {
    if (rawText.startsWith("//", index)) {
      output.push("/");
      index += 2;
      continue;
    }

    const scopeHead = scopeHeadAt(rawText, index);
    if (scopeHead) {
      scopes.push({
        code: scopeHead.code,
        outputStart: output.length,
        rawStart: index,
        ...(scopeHead.value === undefined ? {} : { value: scopeHead.value }),
      });
      index += scopeHead.rawLength;
      continue;
    }

    const inlineCommand = inlineTextCommandAt(rawText, index);
    if (inlineCommand?.closed) {
      const value = inlineCommand.value.trim();
      if (!inlineCommand.definition.valueRequired || value) {
        inlineCues.push(generatedCue(
          `inline:${inlineCommand.definition.code}:${inlineCommand.rawStart}:${cueSequence++}`,
          inlineCommand.definition.cueType,
          output.length,
          output.length,
          value,
        ));
      }
      index = inlineCommand.rawEnd;
      continue;
    }

    if (rawText[index] === "}" && scopes.length) {
      const scope = scopes.pop()!;
      inlineCues.push(...scopeCues(scope, output.length, performance.charactersPerSecond, cueSequence++));
      index += 1;
      continue;
    }

    if (rawText.startsWith("/p", index)) {
      const tail = rawText.slice(index + 2);
      const digits = tail.match(/^\d{1,4}/)?.[0] ?? "";
      const next = tail[digits.length] ?? "";
      const isPause = Boolean(digits) || !next || /\s|[.,!?;:)}\]]/.test(next);
      if (isPause) {
        const length = 2 + digits.length;
        const pauseMs = digits ? Math.max(0, Math.min(9999, Number(digits))) : DEFAULT_PAUSE_MS;
        inlineCues.push(generatedCue(`inline:p:${index}:${cueSequence++}`, "pause", output.length, output.length, pauseMs));
        index += length;
        if (rawText[index] === " " && output.at(-1) === " ") index += 1;
        continue;
      }
    }

    output.push(rawText[index]);
    index += 1;
  }

  while (scopes.length) {
    const scope = scopes.pop()!;
    inlineCues.push(...scopeCues(scope, output.length, performance.charactersPerSecond, cueSequence++));
  }

  return {
    text: output.join(""),
    performance: {
      charactersPerSecond: performance.charactersPerSecond,
      cues: inlineCues,
    },
  };
}
