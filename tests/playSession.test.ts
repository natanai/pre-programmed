import { describe, expect, it } from "vitest";
import { isPlaySessionCompatible, type PersistedPlaySession } from "../src/data/localPlaySession";
import { createEmptyPlayState, resumePlayState } from "../src/engine/project/playState";
import { node, project } from "./fixtures";

function sessionFor(snapshot = project()): PersistedPlaySession {
  const playState = createEmptyPlayState(snapshot, 1_000);
  return {
    version: 1,
    schemaVersion: snapshot.schemaVersion,
    projectRevision: snapshot.revision,
    savedAt: new Date(6_000).toISOString(),
    playState,
    presentation: {
      transcript: [],
      activeText: "",
      activeNodeId: snapshot.startNodeId,
      activeSpeakerId: null,
      activePerformance: { charactersPerSecond: 18, cues: [] },
      pendingDestinationNodeId: null,
    },
  };
}

describe("player session persistence", () => {
  it("allows compatible project revisions but rejects schema changes and deleted locations", () => {
    const original = project({ revision: 3, nodes: [node("a", 1), node("b", 2)] });
    const session = sessionFor(original);
    session.playState.currentNodeId = "b";

    expect(isPlaySessionCompatible(project({ revision: 4, nodes: [node("a", 1), node("b", 2)] }), session)).toBe(true);
    expect(isPlaySessionCompatible(project({ schemaVersion: original.schemaVersion + 1, nodes: [node("a", 1), node("b", 2)] }), session)).toBe(false);
    expect(isPlaySessionCompatible(project({ revision: 4, nodes: [node("a", 1)] }), session)).toBe(false);
  });

  it("preserves elapsed active-play time without counting time spent away", () => {
    const snapshot = project();
    const state = createEmptyPlayState(snapshot, 1_000);
    const resumed = resumePlayState(snapshot, state, 6_000, 20_000);

    expect(resumed.sessionStartedAt).toBe(15_000);
    expect(resumed.variableTimeUpdatedAt).toBe(20_000);
  });
});
