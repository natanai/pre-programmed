import type { PlayState, ProjectSnapshot } from "./model";
import { interpolateSemanticReferences } from "../references/runtime";

/** The authored prompt is ordinary semantic-reference text, not a separate identity system. */
export function resolveTerminalPrompt(snapshot: ProjectSnapshot, state: PlayState): string {
  return interpolateSemanticReferences(snapshot.settings.terminalPrompt, { snapshot, state });
}
