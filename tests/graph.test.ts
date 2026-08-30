import { describe, expect, it } from "vitest";
import {
  branchRelationship,
  buildGraphIndex,
  deadEndDistance,
  isDeadNode,
  notationForNode,
  participatesInCycle,
  traversalPreviousDistance,
} from "../src/game/graph";
import { interaction, node, project } from "./fixtures";

const snapshot = project({
  startNodeId: "a",
  nodes: [node("a", 1), node("b", 2), node("c", 3), node("d", 4), node("e", 5, true), node("f", 6), node("g", 7), node("u", 8)],
  interactions: [
    interaction("ab", "a", "b"), interaction("ac", "a", "c"), interaction("bd", "b", "d"),
    interaction("cd", "c", "d"), interaction("be", "b", "e"), interaction("fg", "f", "g"), interaction("gf", "g", "f"),
  ],
});
const graph = buildGraphIndex(snapshot);

describe("local graph analysis", () => {
  it("distinguishes accidental dead nodes from endings and reports distance", () => {
    expect(isDeadNode(graph, "d")).toBe(true);
    expect(isDeadNode(graph, "e")).toBe(false);
    expect(deadEndDistance(graph, "a")).toBe(2);
    expect(deadEndDistance(graph, "d")).toBe(0);
  });

  it("computes traversal previous and branch shared-origin relationships", () => {
    expect(traversalPreviousDistance(["a", "b"], "b", "a")).toBe(1);
    expect(branchRelationship(graph, ["a", "b"], "b", "c")).toEqual({ back: 1, forward: 1 });
    expect(notationForNode(snapshot, graph, "b", ["a", "b"], "c")).toContain("[B1/1]");
  });

  it("identifies cycles, rejoins, and unreachable nodes", () => {
    expect(participatesInCycle(graph, "f")).toBe(true);
    expect(notationForNode(snapshot, graph, "a", ["a"], "d")).toContain("[R]");
    expect(notationForNode(snapshot, graph, "a", ["a"], "u")).toContain("[U]");
  });
});
