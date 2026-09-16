import { describe, expect, it } from "vitest";
import { createEmptyPlayState, resumeAuthorBookmark } from "../src/engine/project/playState";
import type { AuthorBookmark } from "../src/engine/project/model";
import { node, project } from "./fixtures";

const PERFORMANCE = { charactersPerSecond: 18, cues: [] };

describe("Node opening run checkpoints", () => {
  it("preserves a valid specifically selected opening in an Author bookmark", () => {
    const current = {
      ...node("question", 1),
      openings: [
        {
          id: "question-auto",
          order: 0,
          condition: { type: "always" as const },
          narrationText: "Auto",
          dialogueText: "",
          narrationPerformance: PERFORMANCE,
          dialoguePerformance: PERFORMANCE,
        },
        {
          id: "question-specific",
          order: 1,
          condition: { type: "attempt" as const, operator: "eq" as const, value: 999 },
          narrationText: "Specific",
          dialogueText: "",
          narrationPerformance: PERFORMANCE,
          dialoguePerformance: PERFORMANCE,
        },
      ],
    };
    const snapshot = project({ startNodeId: current.id, nodes: [current] });
    const playState = {
      ...createEmptyPlayState(snapshot, 1_000),
      currentNodeOpeningId: "question-specific",
    };
    const bookmark: AuthorBookmark = {
      id: "bookmark",
      nodeId: current.id,
      traversal: [...playState.traversal],
      playState,
      note: "",
      createdAt: new Date(2_000).toISOString(),
    };

    expect(resumeAuthorBookmark(snapshot, bookmark, 3_000).currentNodeOpeningId).toBe("question-specific");
  });

  it("lets ordinary reconciliation clear a bookmark opening that no longer exists", () => {
    const current = node("question", 1);
    const snapshot = project({ startNodeId: current.id, nodes: [current] });
    const playState = {
      ...createEmptyPlayState(snapshot, 1_000),
      currentNodeOpeningId: "removed-opening",
    };
    const bookmark: AuthorBookmark = {
      id: "bookmark",
      nodeId: current.id,
      traversal: [...playState.traversal],
      playState,
      note: "",
      createdAt: new Date(2_000).toISOString(),
    };

    expect(resumeAuthorBookmark(snapshot, bookmark, 3_000).currentNodeOpeningId).toBeNull();
  });
});
