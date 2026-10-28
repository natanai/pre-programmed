import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { resolveNodeOpeningPresentation } from "../src/features/narrative/runtime/presentation";
import { node, project } from "./fixtures";

describe("numeric Node zero startup", () => {
  it("uses Node identity rather than treating nodeNumber 0 as missing", () => {
    const zero = node("zero", 0);
    zero.openings[0].narrationText = "zero is a valid first node";
    const snapshot = project({ startNodeId: zero.id, nodes: [zero] });

    const state = createEmptyPlayState(snapshot, 1234);
    const presentation = resolveNodeOpeningPresentation(snapshot, state, zero, false);

    expect(state.currentNodeId).toBe("zero");
    expect(state.traversal).toEqual(["zero"]);
    expect(state.currentNodeOpeningId).toBeNull();
    expect(presentation.text).toBe("zero is a valid first node");
    expect(presentation.source).toMatchObject({
      kind: "node",
      id: "zero",
      openingId: "opening-zero",
    });
  });
});
