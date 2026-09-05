import { describe, expect, it } from "vitest";
import { EFFECT_TYPE_SET } from "../src/engine/rules/catalog";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { executeInteraction } from "../src/features/narrative/runtime";
import { createRadixSequence } from "../src/features/radix/model";
import { narrativeMutationValidator } from "../worker/features/narrativeValidation";
import { interaction, node, project } from "./fixtures";

describe("Sort effects and Node entry", () => {
  it("registers sort effects in the shared rule catalog used by Worker validation", () => {
    expect(EFFECT_TYPE_SET.has("radix")).toBe(true);

    const value = interaction("go", "a", "b");
    value.outcomes[0].effects = [{ id: "sort-effect", type: "radix", sequenceId: "sort-1" }];
    expect(narrativeMutationValidator.validate({ type: "interaction.upsert", interaction: value })).toBeNull();
  });

  it("accepts Node entry effects through the same shared effect validator", () => {
    const value = { ...node("b", 2), entryEffects: [{ id: "sort-effect", type: "radix" as const, sequenceId: "sort-1" }] };
    expect(narrativeMutationValidator.validate({ type: "node.upsert", node: value })).toBeNull();
  });

  it("emits the destination Node's sort effect when an interaction enters it", () => {
    const sequence = { ...createRadixSequence(), id: "sort-1", label: "Entry sort" };
    const destination = { ...node("b", 2), entryEffects: [{ id: "sort-effect", type: "radix" as const, sequenceId: sequence.id }] };
    const go = interaction("go", "a", "b");
    const snapshot = project({
      nodes: [node("a", 1), destination],
      interactions: [go],
    });
    snapshot.settings.radix.sequences = [sequence];

    const result = executeInteraction(snapshot, createEmptyPlayState(snapshot), go);
    expect(result.state.currentNodeId).toBe("b");
    expect(result.events).toContainEqual(expect.objectContaining({ type: "radix", sequenceId: "sort-1" }));
    expect(result.events.find((event) => event.type === "radix")?.source).toEqual(expect.objectContaining({ resourceKind: "node", resourceId: "b" }));
  });
});
