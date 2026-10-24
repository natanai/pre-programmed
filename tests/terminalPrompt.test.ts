import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { DEFAULT_PROJECT_SETTINGS, normalizeProjectSettings } from "../src/engine/project/settings";
import { resolveTerminalPrompt } from "../src/engine/project/terminalPrompt";
import { makeSemanticReferenceToken } from "../src/engine/references/runtime";
import { authorSemanticReferenceView, storeAuthorSemanticReferences } from "../src/engine/references/authorSyntax";
import { buildProjectReferences } from "../src/author/references/projectReferences";
import { project } from "./fixtures";

const playerName = {
  id: "variable-player-name",
  key: "player_name",
  label: "Player name",
  valueType: "string" as const,
  initialValue: "",
  interactable: false,
  operations: [],
  hooks: [],
};

describe("terminal prompt semantic references", () => {
  const reference = makeSemanticReferenceToken("state.variable", playerName.id, "value");

  it("preserves trailing spaces in normalized and saved settings", () => {
    const source = `\${reference}> `;
    const settings = normalizeProjectSettings({ ...DEFAULT_PROJECT_SETTINGS, terminalPrompt: source });
    expect(settings.terminalPrompt).toBe(source);
    expect(normalizeProjectSettings({ terminalPrompt: "U:\\\\>  " }).terminalPrompt).toBe("U:\\\\>  ");
    expect(normalizeProjectSettings({ terminalPrompt: "   " }).terminalPrompt).toBe(DEFAULT_PROJECT_SETTINGS.terminalPrompt);
  });

  it("round-trips @-selected variables through the existing author reference syntax", () => {
    const snapshot = project({ variables: [playerName] });
    const context = { snapshot, state: createEmptyPlayState(snapshot) };
    const authored = "{{variable:player_name}}> ";
    const stored = storeAuthorSemanticReferences(authored, context);
    expect(stored).toBe(`${reference}> `);
    expect(authorSemanticReferenceView(stored, context).text).toBe(authored);
  });

  it("reflects changes to the existing State variable during play without another identity system", () => {
    const snapshot = project({
      variables: [playerName],
      settings: { ...DEFAULT_PROJECT_SETTINGS, terminalPrompt: `${reference}> ` },
    });
    const initial = createEmptyPlayState(snapshot);
    expect(resolveTerminalPrompt(snapshot, initial)).toBe("> ");
    const named = { ...initial, values: { ...initial.values, player_name: "Nat" } };
    expect(resolveTerminalPrompt(snapshot, named)).toBe("Nat> ");
    const renamed = { ...named, values: { ...named.values, player_name: "Sage" } };
    expect(resolveTerminalPrompt(snapshot, renamed)).toBe("Sage> ");
  });

  it("registers variable dependencies to the canonical terminal prompt editor", () => {
    const snapshot = project({
      variables: [playerName],
      settings: { ...DEFAULT_PROJECT_SETTINGS, terminalPrompt: `${reference}> ` },
    });
    expect(buildProjectReferences(snapshot)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceKind: "variable",
        resourceId: playerName.id,
        ownerKind: "project-terminal",
        ownerId: "terminal",
        route: { type: "feature", feature: "project", workspace: "terminal-settings" },
      }),
    ]));
  });
});
