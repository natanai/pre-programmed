import type { InteractionChoiceVisibility } from "../../features/narrative/model";
import type { ConditionalSelectionMode } from "../rules/conditionalSelection";

/** Project authoring defaults. They seed new content, never override an existing authored value. */
export type ProjectDefaults = {
  /** Characters per second for newly authored narration, dialogue, response, and command text. */
  textSpeed: number;
  /** Presentation mode for newly authored valid player inputs. */
  inputVisibility: InteractionChoiceVisibility;
  /** Response choice policy for newly authored inputs. */
  responseSelection: ConditionalSelectionMode;
};

export const DEFAULT_PROJECT_DEFAULTS: ProjectDefaults = {
  textSpeed: 18,
  inputVisibility: "prompt",
  responseSelection: "first",
};

export function normalizeProjectDefaults(value: unknown): ProjectDefaults {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    textSpeed: typeof raw.textSpeed === "number" && Number.isFinite(raw.textSpeed)
      ? Math.max(1, Math.min(120, Math.round(raw.textSpeed)))
      : DEFAULT_PROJECT_DEFAULTS.textSpeed,
    inputVisibility: raw.inputVisibility === "immediate" || raw.inputVisibility === "prompt" || raw.inputVisibility === "typed"
      ? raw.inputVisibility
      : DEFAULT_PROJECT_DEFAULTS.inputVisibility,
    responseSelection: raw.responseSelection === "random" ? "random" : "first",
  };
}
