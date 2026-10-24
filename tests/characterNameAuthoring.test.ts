import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { characterNameForPresentation, characterStartingNameSelection } from "../src/features/world/playState";
import { worldEntityWorkspace } from "../src/features/world/author/entityWorkspaces";
import { aliasesFromInput } from "../src/features/world/author/aliasInput";
import type { EntityDefinition } from "../src/features/world/model";
import { makeSemanticReferenceToken, interpolateSemanticReferences } from "../src/engine/references/runtime";
import { migratePortableProject } from "../worker/portableProject";
import { node, project } from "./fixtures";

const canonical = (aliases: EntityDefinition["aliases"] = [], startingNameSelection?: "first" | "random"): EntityDefinition => ({
  id: "old-character", key: "old-character", type: "character", name: "Charlotte",
  aliases, startingNameSelection, description: "", tags: [], operations: [], hooks: [],
});

function importedSnapshot(entity: EntityDefinition, version: 1 | 2 | 3 = 3) {
  const source = project({ entities: [entity] });
  const { revision: _revision, ...withoutRevision } = source;
  return migratePortableProject({
    format: "pre-programmed-project",
    version,
    sourceSchemaVersion: source.schemaVersion,
    exportedAt: "2026-09-01T00:00:00.000Z",
    project: withoutRevision,
    featureData: {},
    ...(version === 1 ? { bookmarks: [] } : {}),
  });
}

function authorRoute() {
  return { type: "feature" as const, feature: "world", workspace: "entity", data: { entityType: "character", resourceId: "old-character" } };
}

describe("Character name author experience", () => {
  it("new characters use their canonical name until the author explicitly chooses randomized names", () => {
    const entity = canonical(["Charlie", "Lottie"], "first");
    const snapshot = project({ entities: [entity] });
    const state = createEmptyPlayState(snapshot, 123);
    expect(state.characterNames[entity.id]).toBe("Charlotte");
    expect(characterNameForPresentation(entity, state, false, snapshot)).toBe("Charlotte");

    const random = { ...entity, startingNameSelection: "random" as const };
    const randomSnapshot = project({ entities: [random] });
    const selected = createEmptyPlayState(randomSnapshot, 123);
    expect(["Charlotte", "Charlie", "Lottie"]).toContain(selected.characterNames[entity.id]);
  });

  it("older imported Characters keep seeded behavior and expose their editable existing aliases", () => {
    for (const version of [1, 2, 3] as const) {
      const entity = canonical(["Charlie", "Lottie"]);
      const document = importedSnapshot(entity, version);
      const snapshot = { ...document.project, revision: 0 };
      const route = authorRoute();
      const context = { snapshot };
      const draft = worldEntityWorkspace.createDraft(route, context as never);
      expect(draft.aliasesInput).toBe("Charlie\nLottie");
      expect(draft.startingNameSelection).toBe("random");
      expect(characterStartingNameSelection(snapshot.entities[0])).toBe("random");
      const spec = worldEntityWorkspace.buildSpec({
        route, context: context as never, draft, setDraft: () => {}, dirty: false, adoptLoadedDraft: () => {},
      });
      const identity = spec.blocks.find((block: { id: string }) => block.id === "world-entity-identity");
      expect(identity).toBeDefined();
      if (identity?.type !== "section") throw new Error("Missing identity section");
      const aliasEditor = identity.children.find((child: { id: string }) => child.id === "world-character-aliases");
      const startingSelection = identity.children.find((child: { id: string }) => child.id === "world-character-starting-name");
      expect(aliasEditor?.type).toBe("custom");
      expect(startingSelection?.type).toBe("select");
      expect(startingSelection?.value).toBe("random");
    }
  });

  it("an older imported Character without aliases doesn't secretly randomize when its first alias is added", () => {
    const document = importedSnapshot(canonical());
    const snapshot = { ...document.project, revision: 0 };
    const draft = worldEntityWorkspace.createDraft(authorRoute(), { snapshot } as never);
    expect(draft.startingNameSelection).toBe("first");
    const edited = { ...draft, aliases: aliasesFromInput("New nickname", draft.aliases ?? []) };
    const updated = { ...edited, aliasesInput: "New nickname" };
    expect(updated.startingNameSelection).toBe("first");
    const state = createEmptyPlayState(project({ entities: [updated] }));
    expect(state.characterNames[updated.id]).toBe("Charlotte");
  });

  it("relationship-based aliases override the seeded choice using the existing When rules", () => {
    const relationship = { id: "relationship", key: "affection", label: "Affection",
      valueType: "number" as const, initialValue: 0, interactable: false, operations: [], hooks: [] };
    const entity = canonical([
      "Charlie",
      { name: "Darling", condition: { type: "variable" as const, key: "affection", operator: "gte" as const, value: 5 } },
    ], "first");
    const snapshot = project({ entities: [entity], variables: [relationship] });
    const base = createEmptyPlayState(snapshot);
    expect(characterNameForPresentation(entity, base, false, snapshot)).toBe("Charlotte");
    const close = { ...base, values: { ...base.values, affection: 6 } };
    expect(characterNameForPresentation(entity, close, false, snapshot)).toBe("Darling");
    const distant = { ...close, values: { ...close.values, affection: 2 } };
    expect(characterNameForPresentation(entity, distant, false, snapshot)).toBe("Charlotte");
  });

  it("nicknames containing @ names remain live and canonical @ Character references resolve them", () => {
    const name = { id: "player-name-var", key: "player_name", label: "Player name",
      valueType: "string" as const, initialValue: "", interactable: false, operations: [], hooks: [] };
    const playerName = makeSemanticReferenceToken("state.variable", name.id, "value");
    const entity = canonical([{ name: `Darling ${playerName}`, condition: { type: "always" } }], "first");
    const snapshot = project({ entities: [entity], variables: [name], nodes: [node("a", 1)] });
    const base = createEmptyPlayState(snapshot);
    const named = { ...base, values: { ...base.values, player_name: "Avery" } };
    expect(characterNameForPresentation(entity, named, false, snapshot)).toBe("Darling Avery");
    expect(interpolateSemanticReferences(makeSemanticReferenceToken("world.character", entity.id, "name"), { snapshot, state: named })).toBe("Darling Avery");
    expect(characterNameForPresentation(entity, named, true, snapshot)).toBe("Charlotte");
  });
});
