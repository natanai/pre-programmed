import { DEFAULT_PROJECT_SETTINGS } from "../src/engine/project/settings";
import type { ProjectSnapshot } from "../src/engine/project/model";
import type { GameNode, Interaction } from "../src/features/narrative/model";

export function node(id: string, nodeNumber: number, ending = false): GameNode {
  return {
    id,
    nodeNumber,
    authorLabel: "",
    openings: [{
      id: `opening-${id}`,
      order: 0,
      condition: { type: "always" },
      narrationText: `node ${id}`,
      dialogueText: "",
      narrationPerformance: { charactersPerSecond: 18, cues: [] },
      dialoguePerformance: { charactersPerSecond: 18, cues: [] },
    }],
    ending,
    tags: [],
    locationId: null,
  };
}

export function interaction(id: string, sourceNodeId: string, targetNodeId: string | null, aliases = [id]): Interaction {
  return {
    id, sourceNodeId, wording: id, choiceVisibility: "prompt", aliases, tags: [], notes: "",
    outcomes: [{
      id: `${id}-outcome`, order: 0, label: "default", authorStatus: "configured", condition: { type: "always" }, responseText: "", dialogueText: "",
      speakerId: null, responsePerformance: { charactersPerSecond: 18, cues: [] }, dialoguePerformance: { charactersPerSecond: 18, cues: [] }, effects: [], disposition: targetNodeId ? "transition" : "stay",
      destination: targetNodeId ? { nodeId: targetNodeId, openingId: null } : null,
    }],
  };
}

export function project(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    schemaVersion: 46, revision: 0, startNodeId: "a", settings: structuredClone(DEFAULT_PROJECT_SETTINGS),
    nodes: [node("a", 1)], interactions: [], entities: [], variables: [], computedValues: [], stateGroups: [], items: [], synthSounds: [], mediaAssets: [],
    ...overrides,
  };
}
