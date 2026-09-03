import { inlineTextCommandAt } from "../../engine/presentation/inlineTextCommandCatalog";
import type { TextCue, TextPerformance } from "./model";

export type CompiledTextPerformance = {
  text: string;
  performance: TextPerformance;
};

type ScopeCode = "l" | "f" | "s" | "h" | "w" | "b" | "i" | "shake" | "speed";

type OpenScope = {
  code: ScopeCode;
  outputStart: number;
  rawStart: number;
  value?: number;
};

const DEFAULT_PAUSE_MS = 350;

export type TextNotationIssue = {
  index: number;
  message: string;
};

function commandHeadAt(rawText: string, index: number) {
  return rawText.slice(index).match(/^\/([a-z][a-z0-9-]*)\{/i);
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

    const longScope = rawText.slice(index).match(/^\/(shake|speed(\d{1,3}))\{/);
    if (longScope) {
      if (longScope[1].startsWith("speed")) {
        const speed = Number(longScope[2]);
        if (speed < 1 || speed > 120) {
          issues.push({ index, message: `Inline speed at character ${index + 1} must be between 1 and 120.` });
        }
      }
      scopes.push({ index, code: longScope[1].startsWith("speed") ? "speed" : "shake" });
      index += longScope[0].length - 1;
      continue;
    }

    const scope = rawText.slice(index).match(/^\/([lfshwbi])\{/);
    if (scope) {
      scopes.push({ index, code: scope[1] as ScopeCode });
      index += 2;
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
      return [generatedCue(id("speed"), "speed", scope.outputStart, end, clampSpeed(scope.value ?? baseSpeed))];
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

    const longScopeMatch = rawText.slice(index).match(/^\/(shake|speed(\d{1,3}))\{/);
    if (longScopeMatch) {
      const isSpeed = longScopeMatch[1].startsWith("speed");
      scopes.push({
        code: isSpeed ? "speed" : "shake",
        outputStart: output.length,
        rawStart: index,
        ...(isSpeed ? { value: Number(longScopeMatch[2]) } : {}),
      });
      index += longScopeMatch[0].length;
      continue;
    }

    const scopeMatch = rawText.slice(index).match(/^\/([lfshwbi])\{/);
    if (scopeMatch) {
      scopes.push({ code: scopeMatch[1] as ScopeCode, outputStart: output.length, rawStart: index });
      index += 3;
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
