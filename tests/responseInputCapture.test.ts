import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { makeSemanticReferenceToken } from "../src/engine/references/runtime";
import { PLAYER_INPUT_BINDING, runtimeBinding } from "../src/engine/rules/runtimeBindings";
import { buildGraphIndex } from "../src/features/narrative/graph";
import {
  armNarrativeFlow,
  resumeNarrativeFlowAfterPresentation,
  resumeNarrativeFlowWithInput,
} from "../src/features/narrative/flowRuntime";
import type { Interaction } from "../src/features/narrative/model";
import { executeInteraction } from "../src/features/narrative/runtime";
import { interaction, node, project } from "./fixtures";

function nameQuestion(targetNodeId: string): Interaction {
  const base = interaction("ask-name", "a", null, ["tell my name"]);
  return {
    ...base,
    outcomes: [{
      ...base.outcomes[0],
      responseText: "What is your name?",
      after: [
        { id: "wait-name", type: "await_input" },
        {
          id: "save-name",
          type: "effects",
          effects: [{
            id: "save-name-value",
            type: "set_value",
            key: "player_name",
            value: runtimeBinding(PLAYER_INPUT_BINDING),
          }],
        },
        {
          id: "recognize-name",
          type: "present",
          responseText: `ooooh, ${makeSemanticReferenceToken("state.variable", "player-name")}. I remember you.`,
          dialogueText: "",
          speakerId: null,
          responsePerformance: { charactersPerSecond: 18, cues: [] },
          dialoguePerformance: { charactersPerSecond: 18, cues: [] },
        },
        {
          id: "continue-after-name",
          type: "transition",
          destination: { nodeId: targetNodeId, openingId: null },
        },
      ],
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

describe("composable Narrative input flow", () => {
  it("waits inside one response, consumes one submission, mutates state, responds, then continues", () => {
    const destination = node("named", 2);
    const question = nameQuestion(destination.id);
    const snapshot = project({
      nodes: [node("a", 1), destination],
      interactions: [question, interaction("ordinary", "a", null, ["Nat"])],
      variables: [nameVariable()],
    });

    const initial = createEmptyPlayState(snapshot, 0);
    const asked = executeInteraction(snapshot, initial, question);

    expect(asked.responseText).toBe("What is your name?");
    expect(asked.state.currentNodeId).toBe("a");
    expect(asked.state.pendingNarrativeFlow).toMatchObject({
      owner: { type: "interaction-outcome", interactionId: question.id, outcomeId: question.outcomes[0].id },
      stepIndex: 0,
      mode: "auto",
    });

    const waiting = resumeNarrativeFlowAfterPresentation(snapshot, asked.state);
    expect(waiting?.responseText).toBe("");
    expect(waiting?.state.pendingNarrativeFlow).toMatchObject({ stepIndex: 0, mode: "input" });

    const submittedState = {
      ...waiting!.state,
      lastCommand: "Nat",
      commandsEntered: waiting!.state.commandsEntered + 1,
    };
    const captured = resumeNarrativeFlowWithInput(snapshot, submittedState, "Nat");

    expect(captured?.state.values.player_name).toBe("Nat");
    expect(captured?.responseText).toBe("ooooh, Nat. I remember you.");
    expect(captured?.state.currentNodeId).toBe("a");
    expect(captured?.state.pendingNarrativeFlow).toMatchObject({ stepIndex: 3, mode: "auto" });

    const continued = resumeNarrativeFlowAfterPresentation(snapshot, captured!.state);
    expect(continued?.state.pendingNarrativeFlow).toBeNull();
    expect(continued?.state.currentNodeId).toBe(destination.id);
  });

  it("lets post-input presentation reference a value written earlier in the same flow", () => {
    const question = nameQuestion("a");
    question.outcomes[0].after = question.outcomes[0].after.slice(0, 3);
    const snapshot = project({
      interactions: [question],
      variables: [nameVariable()],
    });

    const asked = executeInteraction(snapshot, createEmptyPlayState(snapshot, 0), question);
    const waiting = resumeNarrativeFlowAfterPresentation(snapshot, asked.state)!;
    const captured = resumeNarrativeFlowWithInput(snapshot, waiting.state, "Quartz927")!;

    expect(captured.state.values.player_name).toBe("Quartz927");
    expect(captured.responseText).toBe("ooooh, Quartz927. I remember you.");
    expect(captured.state.pendingNarrativeFlow).toBeNull();
  });

  it("runs the same input flow when a Node opening owns it", () => {
    const ask = node("ask", 1);
    const next = node("next", 2);
    ask.openings[0].after = [
      { id: "node-wait", type: "await_input" },
      {
        id: "node-save",
        type: "effects",
        effects: [{
          id: "node-save-name",
          type: "set_value",
          key: "player_name",
          value: runtimeBinding(PLAYER_INPUT_BINDING),
        }],
      },
      {
        id: "node-reply",
        type: "present",
        responseText: `Hello, ${makeSemanticReferenceToken("state.variable", "player-name")}.`,
        dialogueText: "",
        speakerId: null,
        responsePerformance: { charactersPerSecond: 18, cues: [] },
        dialoguePerformance: { charactersPerSecond: 18, cues: [] },
      },
      { id: "node-next", type: "transition", destination: { nodeId: next.id, openingId: null } },
    ];
    const snapshot = project({
      startNodeId: ask.id,
      nodes: [ask, next],
      variables: [nameVariable()],
    });
    const initial = createEmptyPlayState(snapshot, 0);
    const armed = armNarrativeFlow(initial, {
      type: "node-opening",
      nodeId: ask.id,
      openingId: ask.openings[0].id,
    });
    const waiting = resumeNarrativeFlowAfterPresentation(snapshot, armed)!;
    const captured = resumeNarrativeFlowWithInput(snapshot, waiting.state, "Nat")!;

    expect(captured.state.values.player_name).toBe("Nat");
    expect(captured.responseText).toBe("Hello, Nat.");
    const continued = resumeNarrativeFlowAfterPresentation(snapshot, captured.state)!;
    expect(continued.state.currentNodeId).toBe(next.id);
  });

  it("indexes transitions from the same canonical flow used by runtime", () => {
    const destination = node("named", 2);
    const question = nameQuestion(destination.id);
    const snapshot = project({ nodes: [node("a", 1), destination], interactions: [question] });
    const graph = buildGraphIndex(snapshot);

    expect([...graph.outgoing.get("a") ?? []]).toContain(destination.id);
    expect([...graph.incoming.get(destination.id) ?? []]).toContain("a");
  });
});
