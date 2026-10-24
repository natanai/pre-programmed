import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { makeSemanticReferenceToken } from "../src/engine/references/runtime";
import { PLAYER_INPUT_BINDING, runtimeBinding } from "../src/engine/rules/runtimeBindings";
import {
  captureFlowParts,
  capturedInputVariableKey,
  createCaptureInputFlow,
  replaceCapturedInputVariable,
  replaceCaptureEffects,
} from "../src/features/narrative/flow";
import { armNarrativeFlow, resumeNarrativeFlowAfterPresentation, resumeNarrativeFlowWithInput } from "../src/features/narrative/flowRuntime";
import { characterNameForPresentation } from "../src/features/world/playState";
import { appendCapturedTextAlias, entityAuthorDraft } from "../src/features/world/author/entityDraft";
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
    const authored = appendCapturedTextAlias(entityAuthorDraft(char), textVariable.id);
    const token = makeSemanticReferenceToken("state.variable", textVariable.id, "value");
    expect(authored.aliases).toEqual([{ name: token, condition: { type: "always" } }]);
    expect(authored.aliasesInput).toBe(token);
    expect(appendCapturedTextAlias(authored, textVariable.id)).toBe(authored);

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

  it("retains an older Character's existing aliases when the guided nickname is proposed", () => {
    const original = { ...char, startingNameSelection: undefined, aliases: ["Charlie", "Lottie"] };
    const draft = entityAuthorDraft(original);
    expect(draft.startingNameSelection).toBe("random");
    const added = appendCapturedTextAlias(draft, textVariable.id);
    expect(added.aliases?.slice(0, 2)).toEqual(["Charlie", "Lottie"]);
    expect(added.aliases?.length).toBe(3);
    expect(added.startingNameSelection).toBe("random");
    expect(draft.aliases?.length).toBe(2);
  });
});
