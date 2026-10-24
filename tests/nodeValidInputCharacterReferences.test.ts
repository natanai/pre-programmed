import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { authorSemanticReferenceView, storeAuthorSemanticReferences } from "../src/engine/references/authorSyntax";
import { makeSemanticReferenceToken } from "../src/engine/references/runtime";
import { parseCommand, resolvedInteractionInputNames } from "../src/features/commands/parser";
import { executeInteraction } from "../src/features/narrative/runtime";
import { prepareInteractionForSave } from "../src/features/narrative/author/interactionAuthoring";
import { interaction, node, project } from "./fixtures";
import type { EntityDefinition } from "../src/features/world/model";

const god: EntityDefinition = {
  id: "god-id", key: "god", name: "GOD", type: "character",
  aliases: ["Joey", "The Maker"], tags: ["cosmic"],
  description: "", startingNameSelection: "first",
};
const reference = makeSemanticReferenceToken("world.character", god.id, "name");
const playerVariable = {
  id: "nickname-id", key: "nickname", label: "Nickname",
  valueType: "string" as const, initialValue: "", playerPresentation: null,
  interactable: false, operations: [], hooks: [],
};

function setup(aliases: EntityDefinition["aliases"] = god.aliases) {
  const character = { ...god, aliases };
  const primary = interaction("speak", "a", null, [`speak to ${reference}`]);
  primary.wording = `speak to ${reference}`;
  primary.outcomes[0].responseText = "Yes?";
  const snapshot = project({
    nodes: [node("a", 1), node("b", 2)],
    interactions: [primary],
    entities: [character],
    variables: [playerVariable],
  });
  return { snapshot, state: createEmptyPlayState(snapshot), primary };
}

describe("Node valid-input Character references", () => {
  it("stores the @ picker as stable Character identity using existing semantic references", () => {
    const { snapshot, state } = setup();
    const authored = "speak to {{character:god}}";
    const stored = storeAuthorSemanticReferences(authored, { snapshot, state });
    expect(stored).toBe(`speak to ${reference}`);
    expect(authorSemanticReferenceView(stored, { snapshot, state }).text).toBe(authored);
  });

  it("matches the canonical name and every static alias through the same existing interaction", () => {
    const { snapshot, state, primary } = setup();
    for (const name of ["GOD", "Joey", "The Maker", "tHe mAkEr"]) {
      const parsed = parseCommand(`speak to ${name}`, snapshot, state);
      expect(parsed.reason).toMatch(/alias/);
      expect(parsed.interaction?.id).toBe(primary.id);
      expect(executeInteraction(snapshot, { ...state, lastCommand: `speak to ${name}` }, primary).responseText).toBe("Yes?");
    }
    // A Character reference is not a global command and must stay Node-local.
    expect(parseCommand("speak to Joey", snapshot, { ...state, currentNodeId: "b" }).interaction).toBeNull();
    expect(parseCommand("speak to random stranger", snapshot, state).interaction).toBeNull();
    expect(parseCommand("speak to cosmic", snapshot, state).interaction).toBeNull();
  });

  it("resolves variable-backed aliases from the current run without requiring them to be the displayed name", () => {
    const variable = makeSemanticReferenceToken("state.variable", playerVariable.id, "value");
    const { snapshot, state, primary } = setup([
      "Joey",
      { name: variable, condition: { type: "flag", key: "never-shown", value: true } },
      { name: `Captain ${variable}`, condition: { type: "always" } },
    ]);
    expect(parseCommand("speak to Moon", snapshot, state).interaction).toBeNull();
    const named = { ...state, values: { ...state.values, nickname: "Moon" } };
    expect(parseCommand("speak to Moon", snapshot, named).interaction?.id).toBe(primary.id);
    expect(parseCommand("speak to Captain Moon", snapshot, named).interaction?.id).toBe(primary.id);
    expect(parseCommand("speak to GOD", snapshot, named).interaction?.id).toBe(primary.id);
    expect(parseCommand("speak to Joey", snapshot, named).interaction?.id).toBe(primary.id);
    expect(resolvedInteractionInputNames(primary.wording, snapshot, named)).toContain("speak to Captain Moon");
  });

  it("preserves normal literal inputs and existing conditional responses when a reference is used", () => {
    const { snapshot, state, primary } = setup();
    const literal = interaction("wave", "a", null, ["wave"]);
    literal.outcomes[0].responseText = "Hello";
    primary.outcomes = [
      { ...primary.outcomes[0], id: "first", condition: { type: "attempt", operator: "eq", value: 1 }, responseText: "First time" },
      { ...primary.outcomes[0], id: "second", order: 1, condition: { type: "always" }, responseText: "Again" },
    ];
    snapshot.interactions.push(literal);
    const first = parseCommand("speak to Joey", snapshot, state);
    expect(first.interaction?.id).toBe(primary.id);
    const firstExecuted = executeInteraction(snapshot, { ...state, lastCommand: "speak to Joey" }, primary);
    expect(firstExecuted.responseText).toBe("First time");
    expect(executeInteraction(snapshot, firstExecuted.state, primary).responseText).toBe("Again");
    expect(parseCommand("wave", snapshot, state).interaction?.id).toBe(literal.id);
  });

  it("survives the existing Interaction save path without expanding names into duplicate responses", () => {
    const { snapshot, primary } = setup();
    const result = prepareInteractionForSave(primary, false, snapshot);
    expect("interaction" in result).toBe(true);
    if ("interaction" in result) {
      expect(result.interaction.wording).toBe(`speak to ${reference}`);
      expect(result.interaction.aliases).toContain(`speak to ${reference}`);
      expect(result.interaction.outcomes).toHaveLength(1);
    }
  });

  it("does not match a broken Character reference or empty unresolved variable alias", () => {
    const { snapshot, state } = setup();
    expect(resolvedInteractionInputNames("speak to " + makeSemanticReferenceToken("world.character", "missing", "name"), snapshot, state)).toEqual([]);
    expect(parseCommand("speak to", snapshot, state).interaction).toBeNull();
  });
});
