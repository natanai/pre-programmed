import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { makeSemanticReferenceToken } from "../src/engine/references/runtime";
import { PLAYER_INPUT_BINDING, runtimeBinding } from "../src/engine/rules/runtimeBindings";
import { parseCommand } from "../src/features/commands/parser";
import { buildGraphIndex } from "../src/features/narrative/graph";
import type { Interaction } from "../src/features/narrative/model";
import { executeInteraction } from "../src/features/narrative/runtime";
import { interaction, node, project } from "./fixtures";

function nameQuestion(targetNodeId: string): Interaction {
  return {
    ...interaction("ask-name", "a", null, ["tell my name"]),
    outcomes: [{
      ...interaction("ask-name", "a", null, ["tell my name"]).outcomes[0],
      responseText: "What is your name?",
      inputCapture: {
        effects: [{
          id: "save-name",
          type: "set_value",
          key: "player_name",
          value: runtimeBinding(PLAYER_INPUT_BINDING),
        }],
        disposition: "transition",
        destination: { nodeId: targetNodeId, openingId: null },
      },
      disposition: "stay",
      destination: null,
    }],
  };
}

function nameVariable() {
  return {
    id: "player-name",
    key: "player_name",
    label: "Player name",
    valueType: "string" as const,
    initialValue: "",
    playerPresentation: null,
    interactable: false,
    operations: [],
    hooks: [],
  };
}

describe("response input capture", () => {
  it("consumes the next terminal submission before ordinary command matching, then continues", () => {
    const destination = node("named", 2);
    const question = nameQuestion(destination.id);
    const ordinary = interaction("ordinary", "a", null, ["Nat"]);
    const snapshot = project({
      nodes: [node("a", 1), destination],
      interactions: [question, ordinary],
      variables: [nameVariable()],
    });

    const initial = createEmptyPlayState(snapshot, 0);
    const asked = executeInteraction(snapshot, initial, question);

    expect(asked.responseText).toBe("What is your name?");
    expect(asked.state.currentNodeId).toBe("a");
    expect(asked.state.pendingInputCapture).toEqual({
      interactionId: question.id,
      outcomeId: question.outcomes[0].id,
    });

    const submitted = { ...asked.state, lastCommand: "Nat", commandsEntered: asked.state.commandsEntered + 1 };
    const parsed = parseCommand("Nat", snapshot, submitted);

    expect(parsed.reason).toBe("capture");
    expect(parsed.interaction?.id).toBe(question.id);

    const captured = executeInteraction(snapshot, submitted, parsed.interaction!);
    expect(captured.state.values.player_name).toBe("Nat");
    expect(captured.state.pendingInputCapture).toBeNull();
    expect(captured.state.currentNodeId).toBe(destination.id);
  });

  it("makes a captured string available to semantic references in following responses", () => {
    const destination = node("named", 2);
    const question = nameQuestion(destination.id);
    const followUp = interaction("recognize-name", destination.id, null, ["are you god?"]);
    followUp.outcomes[0] = {
      ...followUp.outcomes[0],
      responseText: `ooooh, ${makeSemanticReferenceToken("state.variable", "player-name")}. please don't tell anyone.`,
    };
    const snapshot = project({
      nodes: [node("a", 1), destination],
      interactions: [question, followUp],
      variables: [nameVariable()],
    });

    const initial = createEmptyPlayState(snapshot, 0);
    const asked = executeInteraction(snapshot, initial, question);
    const submitted = { ...asked.state, lastCommand: "Nat", commandsEntered: asked.state.commandsEntered + 1 };
    const captured = executeInteraction(snapshot, submitted, question);
    const recognized = executeInteraction(snapshot, captured.state, followUp);

    expect(captured.state.values.player_name).toBe("Nat");
    expect(recognized.responseText).toBe("ooooh, Nat. please don't tell anyone.");
  });

  it("represents the post-capture continuation in the canonical narrative graph", () => {
    const destination = node("named", 2);
    const question = nameQuestion(destination.id);
    const snapshot = project({ nodes: [node("a", 1), destination], interactions: [question] });
    const graph = buildGraphIndex(snapshot);

    expect([...graph.outgoing.get("a") ?? []]).toContain(destination.id);
    expect([...graph.incoming.get(destination.id) ?? []]).toContain("a");
  });
});
