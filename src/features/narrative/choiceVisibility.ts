import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { evaluateCondition } from "../../engine/rules/conditions";
import { ALWAYS } from "../../engine/rules/model";
import type { Interaction } from "./model";

/**
 * Determine whether an authored interaction should be suggested as a player choice.
 *
 * This is presentation-only. Typed command recognition deliberately does not call
 * this helper, so a player can always type an authored input and let its response
 * conditions decide what happens.
 */
export function isInteractionChoiceVisible(
  snapshot: ProjectSnapshot,
  state: PlayState,
  interaction: Interaction,
) {
  if (state.interactionVisibility[interaction.id] === false) return false;
  return evaluateCondition(interaction.choiceVisibleWhen ?? ALWAYS, {
    snapshot,
    state,
    eventKey: `interaction:${interaction.id}`,
  });
}
