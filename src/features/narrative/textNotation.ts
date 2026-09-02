import type { TextCue, TextPerformance } from "./model";

export type CompiledTextPerformance = {
  text: string;
  performance: TextPerformance;
};

type ScopeCode = "l" | "f" | "s" | "h" | "w" | "b" | "i";

type OpenScope = {
  code: ScopeCode;
  outputStart: number;
  rawStart: number;
};

const DEFAULT_PAUSE_MS = 350;

export type TextNotationIssue = {
  index: number;
  message: string;
};

/** Validate authored inline notation before it reaches the player. */
export function validateTextNotation(rawText: string): TextNotationIssue[] {
  const issues: TextNotationIssue[] = [];
  const scopes: number[] = [];
  for (let index = 0; index < rawText.length; index += 1) {
    if (rawText.startsWith("//", index)) {
      index += 1;
      continue;
    }
    const scope = rawText.slice(index).match(/^\/([lfshwbi])\{/);
    if (scope) {
      scopes.push(index);
      index += 2;
      continue;
    }
    if (/^\/[a-z]\{/i.test(rawText.slice(index))) {
      issues.push({ index, message: `Unknown text rule at character ${index + 1}.` });
      continue;
    }
    if (rawText[index] === "}") {
      if (scopes.length) scopes.pop();
      else issues.push({ index, message: `Unmatched } at character ${index + 1}.` });
    }
  }
  for (const index of scopes) issues.push({ index, message: `Text rule opened at character ${index + 1} needs a closing }.` });
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
  }
}

/**
 * Compile terse slash notation embedded in authored prose into Narrative's
 * existing TextPerformance cue model. The authored source string remains
 * unchanged in storage; player-facing copy has control notation removed.
 */
export function compileTextNotation(rawText: string, performance: TextPerformance): CompiledTextPerformance {
  const output: string[] = [];
  const boundaryMap = new Array<number>(rawText.length + 1).fill(0);
  const scopes: OpenScope[] = [];
  const inlineCues: TextCue[] = [];
  let cueSequence = 0;
  let index = 0;

  const mapSkipped = (start: number, count: number) => {
    for (let offset = 0; offset <= count; offset += 1) boundaryMap[start + offset] = output.length;
  };

  while (index < rawText.length) {
    boundaryMap[index] = output.length;

    if (rawText.startsWith("//", index)) {
      mapSkipped(index, 1);
      output.push("/");
      index += 2;
      boundaryMap[index] = output.length;
      continue;
    }

    const scopeMatch = rawText.slice(index).match(/^\/([lfshwbi])\{/);
    if (scopeMatch) {
      scopes.push({ code: scopeMatch[1] as ScopeCode, outputStart: output.length, rawStart: index });
      mapSkipped(index, 2);
      index += 3;
      boundaryMap[index] = output.length;
      continue;
    }

    if (rawText[index] === "}" && scopes.length) {
      const scope = scopes.pop()!;
      inlineCues.push(...scopeCues(scope, output.length, performance.charactersPerSecond, cueSequence++));
      mapSkipped(index, 1);
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
        mapSkipped(index, length);
        index += length;
        if (rawText[index] === " " && output.at(-1) === " ") {
          mapSkipped(index, 1);
          index += 1;
        }
        continue;
      }
    }

    output.push(rawText[index]);
    index += 1;
    boundaryMap[index] = output.length;
  }

  while (scopes.length) {
    const scope = scopes.pop()!;
    inlineCues.push(...scopeCues(scope, output.length, performance.charactersPerSecond, cueSequence++));
  }

  const mapPosition = (position: number) => boundaryMap[Math.max(0, Math.min(rawText.length, position))] ?? output.length;
  const authoredCues = performance.cues.map((cue) => ({
    ...cue,
    start: mapPosition(cue.start),
    end: mapPosition(cue.end),
  }));

  return {
    text: output.join(""),
    performance: {
      charactersPerSecond: performance.charactersPerSecond,
      cues: [...authoredCues, ...inlineCues],
    },
  };
}
