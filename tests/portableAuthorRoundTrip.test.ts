import { describe, expect, it } from "vitest";
import { entityAuthorDraft } from "../src/features/world/author/entityDraft";
import { aliasesFromInput, normalizedAliases } from "../src/features/world/author/aliasInput";
import type { EntityDefinition } from "../src/features/world/model";
import { migratePortableProject } from "../worker/portableProject";
import { validateMutationBody } from "../worker/validation";
import { project } from "./fixtures";

const olderCharacter: EntityDefinition = {
  id: "char-imported", key: "rose", type: "character", name: "Rose",
  aliases: ["Rosie", "Ro"], description: "", tags: [],
  portraitAssetId: null, interactable: false, operations: [], hooks: [],
};

function importOlderGame(version: 1 | 2 | 3) {
  const snapshot = project({ entities: [olderCharacter] });
  const { revision: _revision, ...portable } = snapshot;
  const file = JSON.stringify({
    format: "pre-programmed-project",
    version,
    exportedAt: "2026-09-14T12:00:00.000Z",
    sourceSchemaVersion: snapshot.schemaVersion,
    project: portable,
    featureData: {},
    ...(version === 1 ? { bookmarks: [] } : {}),
  });
  const document = migratePortableProject(JSON.parse(file));
  return { ...document.project, revision: 4 };
}

function editImportedAliases(version: 1 | 2 | 3) {
  const imported = importOlderGame(version);
  const draft = entityAuthorDraft(imported.entities[0]);
  const value = "Rosie\nSweetheart";
  const edited = { ...draft, aliasesInput: value, aliases: aliasesFromInput(value, draft.aliases ?? []) };
  const saved = { ...edited, aliases: normalizedAliases(edited) };
  delete (saved as typeof saved & { aliasesInput?: string }).aliasesInput;
  return { imported, draft, saved };
}

describe("portable Windows .ppgame import -> Character edit -> save", () => {
  it.each([1, 2, 3] as const)("preserves editable older Character aliases from portable version %s", (version) => {
    const { imported, draft, saved } = editImportedAliases(version);
    expect(imported.entities[0].aliases).toEqual(["Rosie", "Ro"]);
    expect(draft.aliasesInput).toBe("Rosie\nRo");
    expect(saved.aliases).toEqual([{ name: "Rosie" }, { name: "Sweetheart" }]);
    expect(validateMutationBody({
      expectedRevision: imported.revision,
      description: "Save character Rose",
      operations: [{ type: "entity.upsert", entity: saved }],
    })).toBeNull();
    expect(saved.startingNameSelection).toBe("random");
  });

  it("accepts conditional and @ aliases saved through the same Character editor", () => {
    const { imported, saved } = editImportedAliases(3);
    const entity: EntityDefinition = {
      ...saved,
      aliases: [
        { name: "Sweetheart", condition: { type: "variable", key: "affection", operator: "gte", value: 5 } },
        { name: "{{ref:state.variable:player_name:value}}", condition: { type: "always" } },
      ],
    };
    expect(validateMutationBody({
      expectedRevision: imported.revision, description: "Save character Rose",
      operations: [{ type: "entity.upsert", entity }],
    })).toBeNull();
  });

  it("rejects bad aliases and unsupported selection modes before persistence", () => {
    const { saved } = editImportedAliases(3);
    const validate = (entity: unknown) => validateMutationBody({
      expectedRevision: 4, description: "Save character Rose", operations: [{ type: "entity.upsert", entity }],
    });
    expect(validate({ ...saved, aliases: [{ name: "Darling", condition: { type: "bogus" } }] })).toBe("World entity aliases are invalid.");
    expect(validate({ ...saved, aliases: [{ name: 42 }] })).toBe("World entity aliases are invalid.");
    expect(validate({ ...saved, startingNameSelection: "lottery" })).toBe("Character starting name selection is invalid.");
  });

  it("allows the normal @ terminal prompt size at the same Worker mutation boundary", () => {
    const settings = { ...project().settings, terminalPrompt: "{{ref:state.variable:player_name:value}}> " };
    expect(settings.terminalPrompt.length).toBeGreaterThan(32);
    expect(validateMutationBody({
      expectedRevision: 0,
      description: "Save terminal prompt",
      operations: [{ type: "project.settings", settings }],
    })).toBeNull();
  });
});
