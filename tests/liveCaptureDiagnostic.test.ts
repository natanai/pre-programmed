import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import type { ProjectSnapshot } from "../src/engine/project/model";
import { parseCommand } from "../src/features/commands/parser";
import { executeInteraction } from "../src/features/narrative/runtime";

describe("live capture diagnostic", () => {
  it("captures the next input from the deployed authored project", async () => {
    const response = await fetch("https://pre-programmed.natanai.workers.dev/api/project/snapshot", { cache: "no-store" });
    expect(response.ok).toBe(true);
    const snapshot = await response.json() as ProjectSnapshot;
    const interaction = snapshot.interactions.find((candidate) => candidate.wording === "do you love me?");
    expect(interaction).toBeTruthy();
    if (!interaction) return;

    let state = createEmptyPlayState(snapshot, 0);
    state = {
      ...state,
      currentNodeId: interaction.sourceNodeId,
      currentNodeOpeningId: null,
      traversal: [interaction.sourceNodeId],
      visitedNodeIds: [interaction.sourceNodeId],
      lastCommand: "do you love me?",
      commandsEntered: 1,
    };

    const question = executeInteraction(snapshot, state, interaction);
    expect(question.dialogueText).toContain("who are you?");
    expect(question.state.pendingInputCapture).toEqual({
      interactionId: interaction.id,
      outcomeId: interaction.outcomes[0].id,
    });

    const answerState = {
      ...question.state,
      lastCommand: "Nat",
      commandsEntered: question.state.commandsEntered + 1,
    };
    const parsed = parseCommand("Nat", snapshot, answerState);
    expect(parsed.reason).toBe("capture");
    expect(parsed.interaction?.id).toBe(interaction.id);

    const answer = executeInteraction(snapshot, answerState, interaction);
    expect(answer.state.values.player_name).toBe("Nat");
    expect(answer.state.pendingInputCapture).toBeNull();
    expect(answer.state.currentNodeId).toBe(interaction.sourceNodeId);
  });
});
