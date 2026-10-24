import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { makeSemanticReferenceToken } from "../src/engine/references/runtime";
import { PLAYER_INPUT_BINDING, runtimeBinding } from "../src/engine/rules/runtimeBindings";
import {
  captureFlowParts,
  captureFlowSegments,
  appendCaptureTurn,
  removeCaptureTurn,
  createTransitionStep,
  replaceCapturePresentation,
  capturedInputVariableKey,
  createCaptureInputFlow,
  replaceCapturedInputVariable,
  replaceCaptureEffects,
} from "../src/features/narrative/flow";
import { armNarrativeFlow, resumeNarrativeFlowAfterPresentation, resumeNarrativeFlowWithInput } from "../src/features/narrative/flowRuntime";
import { characterNameForPresentation } from "../src/features/world/playState";
import { entityAuthorDraft } from "../src/features/world/author/entityDraft";
import { aliasesFromInput } from "../src/features/world/author/aliasInput";
import { node, project } from "./fixtures";
import type { EntityDefinition } from "../src/features/world/model";

const char: EntityDefinition = {
  id: "charlotte", type: "character", key: "charlotte", name: "Charlotte",
  aliases: [], description: "", tags: [], portraitAssetId: null,
  interactable: false, operations: [], hooks: [], startingNameSelection: "first",
};
const textVariable = {
  id: "charlotte-nickname-id", key: "charlotte_nickname", label: "Charlotte nickname",
  valueType: "string" as const, initialValue: "", playerPresentation: null,
  interactable: false, operations: [], hooks: [],
};

describe("guided name capture reuses canonical Narrative, State and World", () => {
  it("uses the real Set Variable effect without creating a second capture/save path", () => {
    const empty = createCaptureInputFlow();
    expect(empty.map((step) => step.type)).toEqual(["await_input", "effects", "present"]);
    expect(capturedInputVariableKey(empty)).toBe("");
    const saved = replaceCapturedInputVariable(empty, textVariable.key);
    expect(saved.map((step) => step.type)).toEqual(empty.map((step) => step.type));
    expect(captureFlowParts(saved)?.effectsStep.effects).toMatchObject([{
      type: "set_value", key: textVariable.key,
      value: runtimeBinding(PLAYER_INPUT_BINDING),
    }]);
    expect(capturedInputVariableKey(saved)).toBe(textVariable.key);

    const savedAgain = replaceCapturedInputVariable(saved, textVariable.key);
    expect(savedAgain).toEqual(saved);
    expect(captureFlowParts(replaceCapturedInputVariable(saved, ""))?.effectsStep.effects).toEqual([]);
  });

  it("keeps all other effects and post-input presentation when changing the saved variable", () => {
    const base = createCaptureInputFlow();
    const effects = [{ id: "notify", type: "notification" as const, text: "submitted" }];
    const extended = replaceCaptureEffects(base, effects);
    const set = replaceCapturedInputVariable(extended, textVariable.key);
    expect(captureFlowParts(set)?.effectsStep.effects[1]).toEqual(effects[0]);
    const cleared = replaceCapturedInputVariable(set, "");
    expect(captureFlowParts(cleared)?.effectsStep.effects).toEqual(effects);
    expect(cleared[0]).toEqual(base[0]);
    expect(cleared[2]).toEqual(base[2]);
  });

  it("player submits a nickname once, State stores it, and canonical Character @ alias displays it", () => {
    const token = makeSemanticReferenceToken("state.variable", textVariable.id, "value");
    const draft = entityAuthorDraft(char);
    const authored = { ...draft, aliases: [{ name: token, condition: { type: "variable" as const, key: textVariable.key, operator: "neq" as const, value: "" } }], aliasesInput: token };
    expect(authored.aliases).toEqual([{ name: token, condition: { type: "variable", key: textVariable.key, operator: "neq", value: "" } }]);
    expect(authored.aliasesInput).toBe(token);

    const ask = node("ask", 1);
    ask.openings[0].narrationText = "What would you like to call me?";
    ask.openings[0].after = replaceCapturedInputVariable(createCaptureInputFlow(), textVariable.key);
    const snapshot = project({
      nodes: [ask], startNodeId: ask.id,
      variables: [textVariable], entities: [authored],
    });
    const initial = createEmptyPlayState(snapshot, 0);
    expect(characterNameForPresentation(authored, initial, false, snapshot)).toBe("Charlotte");
    const armed = armNarrativeFlow(initial, { type: "node-opening", nodeId: ask.id, openingId: ask.openings[0].id });
    const waiting = resumeNarrativeFlowAfterPresentation(snapshot, armed);
    expect(waiting?.state.pendingNarrativeFlow?.mode).toBe("input");
    const submitted = resumeNarrativeFlowWithInput(snapshot, waiting!.state, "Sweetheart")!;
    expect(submitted.state.values.charlotte_nickname).toBe("Sweetheart");
    expect(characterNameForPresentation(authored, submitted.state, false, snapshot)).toBe("Sweetheart");
    expect(characterNameForPresentation(authored, submitted.state, true, snapshot)).toBe("Charlotte");
    expect(submitted.state.pendingNarrativeFlow).toBeNull();
  });

  it("does not add Character aliases implicitly; imported aliases remain independently editable", () => {
    const oldCharacter = { ...char, startingNameSelection: undefined, aliases: ["Charlie", "Lottie"] };
    const draft = entityAuthorDraft(oldCharacter);
    expect(draft.startingNameSelection).toBe("random");
    expect(aliasesFromInput("Charlie\\nLottie\\n{{variable:charlotte_nickname}}", draft.aliases ?? []).length).toBe(3);
    expect(draft.aliases).toEqual(["Charlie", "Lottie"]);
  });

  it("captures a conversation of three questions in one Node without a new conditional opening", () => {
    const first = createCaptureInputFlow();
    const firstId = captureFlowParts(first)!.awaitStep.id;
    const second = appendCaptureTurn(first);
    const secondId = captureFlowSegments(second)[1].awaitStep.id;
    const third = appendCaptureTurn(second);
    const thirdId = captureFlowSegments(third)[2].awaitStep.id;
    expect(new Set([firstId, secondId, thirdId]).size).toBe(3);
    expect(third.map((step) => step.type)).toEqual([
      "await_input", "effects", "present",
      "await_input", "effects", "present",
      "await_input", "effects", "present",
    ]);

    const firstSaved = replaceCapturedInputVariable(third, "player_name", firstId);
    const secondSaved = replaceCapturedInputVariable(firstSaved, "", secondId);
    const thirdSaved = replaceCapturedInputVariable(secondSaved, "charlotte_nickname", thirdId);
    const addReply = (flow: typeof third, id: string, text: string) => {
      const part = captureFlowParts(flow, id)!;
      return replaceCapturePresentation(flow, { ...part.presentStep, responseText: text }, id);
    };
    const replies = addReply(addReply(addReply(thirdSaved, firstId, "How old are you, {{variable:player_name}}?"), secondId, "And your preferred nickname?"), thirdId, "Thank you.");
    const n = node("questions", 1);
    n.openings[0].narrationText = "What is your name?";
    n.openings[0].after = replies;
    const snapshot = project({ nodes: [n], startNodeId: n.id, variables: [{ ...textVariable, id: "player-name", key: "player_name", label: "Player name" }, textVariable] });
    const initial = createEmptyPlayState(snapshot, 0);
    const armed = armNarrativeFlow(initial, { type: "node-opening", nodeId: n.id, openingId: n.openings[0].id });
    const waiting1 = resumeNarrativeFlowAfterPresentation(snapshot, armed)!;
    expect(waiting1.state.pendingNarrativeFlow?.mode).toBe("input");
    const reply1 = resumeNarrativeFlowWithInput(snapshot, waiting1.state, "Ada")!;
    expect(reply1.state.values.player_name).toBe("Ada");
    expect(reply1.responseText).toContain("How old are you");
    const waiting2 = resumeNarrativeFlowAfterPresentation(snapshot, reply1.state)!;
    expect(waiting2.state.pendingNarrativeFlow?.mode).toBe("input");
    const reply2 = resumeNarrativeFlowWithInput(snapshot, waiting2.state, "24")!;
    expect(reply2.responseText).toContain("preferred nickname");
    expect(reply2.state.values.player_name).toBe("Ada");
    expect(reply2.state.values.charlotte_nickname).toBe("");
    const waiting3 = resumeNarrativeFlowAfterPresentation(snapshot, reply2.state)!;
    expect(waiting3.state.pendingNarrativeFlow?.mode).toBe("input");
    const reply3 = resumeNarrativeFlowWithInput(snapshot, waiting3.state, "Moon")!;
    expect(reply3.state.values.charlotte_nickname).toBe("Moon");
    expect(reply3.responseText).toBe("Thank you.");
    expect(reply3.state.pendingNarrativeFlow).toBeNull();
  });

  it("inserts another capture before an existing Node transition, without losing effects or route", () => {
    const initial = createCaptureInputFlow();
    const routed = [...initial, createTransitionStep({ nodeId: "next", openingId: null })];
    const extended = appendCaptureTurn(routed);
    expect(extended.at(-1)).toEqual(routed.at(-1));
    expect(captureFlowSegments(extended)).toHaveLength(2);
    const second = captureFlowSegments(extended)[1];
    const withEffect = replaceCapturedInputVariable(extended, textVariable.key, second.awaitStep.id);
    expect(capturedInputVariableKey(withEffect, second.awaitStep.id)).toBe(textVariable.key);
    expect(capturedInputVariableKey(withEffect, captureFlowSegments(withEffect)[0].awaitStep.id)).toBe("");
    const removed = removeCaptureTurn(withEffect, second.awaitStep.id);
    expect(removed).toEqual(routed);
  });

});
