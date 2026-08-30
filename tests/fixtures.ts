import type { GameNode, Interaction, ProjectSnapshot } from "../src/game/model";

export function node(id: string, nodeNumber: number, ending = false): GameNode {
  return { id, nodeNumber, text: `node ${id}`, ending, tags: [], characterId: null, locationId: null, performance: { charactersPerSecond: 18, cues: [] } };
}

export function interaction(id: string, sourceNodeId: string, destinationNodeId: string | null, aliases = [id]): Interaction {
  return {
    id, sourceNodeId, wording: id, aliases, tags: [], notes: "",
    outcomes: [{
      id: `${id}-outcome`, order: 0, label: "default", condition: { type: "always" }, responseText: "",
      effects: [], disposition: destinationNodeId ? "transition" : "stay", destinationNodeId,
    }],
  };
}

export function project(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    schemaVersion: 3, revision: 0, startNodeId: "a", nodes: [node("a", 1)], interactions: [], entities: [], variables: [],
    computedValues: [], items: [], synthSounds: [], ...overrides,
  };
}
