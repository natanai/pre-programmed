import { describe, expect, it } from "vitest";
import { authorSemanticReferenceView, storeAuthorSemanticReferences } from "../src/engine/references/authorSyntax";
import { interpolateSemanticReferences, makeSemanticReferenceToken } from "../src/engine/references/runtime";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { characterNameForPresentation, characterNameOptions } from "../src/features/world/playState";
import { aliasesFromInput, normalizedAliases } from "../src/features/world/author/aliasInput";
import { referencesTo } from "../src/author/references/projectReferences";
import { parseCommand } from "../src/features/commands/parser";
import { node, project } from "./fixtures";
import type { EntityDefinition } from "../src/features/world/model";

const playerName = {
  id: "name-variable",
  key: "player_name",
  label: "Player name",
  valueType: "string" as const,
  initialValue: "",
  interactable: false,
  operations: [],
  hooks: [],
};
const ref = makeSemanticReferenceToken("state.variable", playerName.id, "value");

function buildCharacter(aliases: EntityDefinition["aliases"] = []): EntityDefinition {
  return { id: "player", key: "player-character", type: "character", name: "Player character",
    aliases, description: "", tags: [], operations: ["inspect"], interactable: true, hooks: [] };
}

describe("Character aliases use ordinary @ references", () => {
  it("keeps a seeded alias as a stable reference template while its current value changes", () => {
    const character = buildCharacter([ref]);
    const snapshot = project({ entities: [character], variables: [playerName] });
    const initial = createEmptyPlayState(snapshot);
    const selected = { ...initial, characterNames: { ...initial.characterNames, player: ref } };
    const named = { ...selected, values: { ...selected.values, player_name: "Nat" } };
    const renamed = { ...named, values: { ...named.values, player_name: "Juniper" } };

    expect(characterNameOptions(character)).toEqual(["Player character", ref]);
    expect(characterNameForPresentation(character, selected, false, snapshot)).toBe("Player character");
    expect(characterNameForPresentation(character, named, false, snapshot)).toBe("Nat");
    expect(characterNameForPresentation(character, renamed, false, snapshot)).toBe("Juniper");
    expect(characterNameForPresentation(character, renamed, true, snapshot)).toBe("Player character");
    expect(renamed.characterNames.player).toBe(ref);
    expect(interpolateSemanticReferences(makeSemanticReferenceToken("world.character", character.id, "name"),
      { snapshot, state: named })).toBe("Nat");
  });

  it("resolves conditional and mixed-text aliases through the shared reference runtime", () => {
    const character = buildCharacter([
      { name: `Captain ${ref}`, condition: { type: "flag", key: "introduced", value: true } },
      { name: "Mysterious voice", condition: { type: "flag", key: "introduced", value: false } },
    ]);
    const snapshot = project({ entities: [character], variables: [playerName] });
    const state = createEmptyPlayState(snapshot);
    const hidden = { ...state, values: { ...state.values, introduced: false } };
    const revealed = { ...state, values: { ...state.values, introduced: true, player_name: "Sage" } };

    expect(characterNameForPresentation(character, hidden, false, snapshot)).toBe("Mysterious voice");
    expect(characterNameForPresentation(character, revealed, false, snapshot)).toBe("Captain Sage");
    expect(characterNameForPresentation(character, revealed, true, snapshot)).toBe("Player character");
  });

  it("makes the displayed variable name available to the actual player command grammar", () => {
    const character = buildCharacter([{ name: ref, condition: { type: "always" } }]);
    const base = project({
      entities: [character], variables: [playerName],
      nodes: [{ ...node("a", 1), conversationMode: "set", conversationCharacterId: character.id }],
    });
    const snapshot = { ...base, settings: { ...base.settings, commands: {
      ...base.settings.commands,
      commands: [{ id: "inspect-character", label: "Inspect", enabled: true,
        patterns: ["inspect {target}"], slots: [{ name: "target", sourceKinds: ["world.character"] }],
        action: { type: "target-operation" as const, operation: "inspect", targetSlot: "target" } }],
      referenceSources: [{ sourceKind: "world.character", enabled: true, includeDefaults: true, aliases: {} }],
    } } };
    const initial = createEmptyPlayState(snapshot);
    const state = { ...initial, values: { ...initial.values, player_name: "Nat" } };

    expect(parseCommand("inspect Nat", snapshot, state).invocation?.target)
      .toEqual({ kind: "world.entity", id: character.id });
    expect(parseCommand("inspect Player character", snapshot, state).invocation).toBeNull();
  });

  it("lets the existing multiline @ picker store stable alias references and preserve alias rules", () => {
    const snapshot = project({ variables: [playerName] });
    const context = { snapshot, state: createEmptyPlayState(snapshot) };
    const input = "Mysterious voice\nCaptain {{variable:player_name}}\n";
    const stored = storeAuthorSemanticReferences(input, context);
    expect(stored).toBe(`Mysterious voice\nCaptain ${ref}\n`);
    expect(authorSemanticReferenceView(stored, context).text).toBe(input);

    const condition = { type: "always" as const };
    const previous = [{ name: `Captain ${ref}`, condition }];
    expect(aliasesFromInput(stored, previous)).toEqual([
      { name: "Mysterious voice" }, { name: `Captain ${ref}`, condition },
    ]);
    expect(normalizedAliases(buildCharacter([{ name: `Captain ${ref}`, condition }]))).toEqual([
      { name: `Captain ${ref}`, condition },
    ]);
  });

  it("preserves editable dependencies from the alias to the underlying variable owner", () => {
    const character = buildCharacter([{ name: ref, condition: { type: "always" } }]);
    const snapshot = project({ variables: [playerName], entities: [character] });
    expect(referencesTo(snapshot, "variable", playerName.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerKind: "character", ownerId: character.id,
        detail: expect.stringContaining("character alias name") }),
    ]));
  });

  it("does not recursively resolve aliases referencing their own Character", () => {
    const self = makeSemanticReferenceToken("world.character", "player", "name");
    const character = buildCharacter([{ name: self, condition: { type: "always" } }]);
    const snapshot = project({ entities: [character] });
    const state = createEmptyPlayState(snapshot);
    expect(characterNameForPresentation(character, state, false, snapshot)).toBe("Player character");
  });
});
