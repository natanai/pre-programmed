import { DEFAULT_PROJECT_SETTINGS } from "../src/engine/project/settings";
import type { ProjectSnapshot } from "../src/engine/project/model";
import type { GameNode, Interaction } from "../src/features/narrative/model";

export function node(id: string, nodeNumber: number, ending = false): GameNode {
  return {
    id,
    nodeNumber,
    text: `node ${id}`,
    dialogueText: "",
    ending,
    tags: [],
    locationId: null,
    locationMode: "continue",
    conversationCharacterId: null,
    conversationMode: "continue",
    performance: { charactersPerSecond: 18, cues: [] },
    dialoguePerformance: { charactersPerSecond: 18, cues: [] },
  };
}

export function interaction(id: string, sourceNodeId: string, destinationNodeId: string | null, aliases = [id]): Interaction {
  return {
    id, sourceNodeId, wording: id, choiceVisibility: "prompt", aliases, tags: [], notes: "",
    outcomes: [{
      id: `${id}-outcome`, order: 0, label: "default", authorStatus: "configured", condition: { type: "always" }, responseText: "",
      speakerId: null, responsePerformance: { charactersPerSecond: 18, cues: [] }, effects: [], disposition: destinationNodeId ? "transition" : "stay", destinationNodeId,
    }],
  };
}

export function project(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    schemaVersion: 12, revision: 0, startNodeId: "a", settings: structuredClone(DEFAULT_PROJECT_SETTINGS),
    nodes: [node("a", 1)], interactions: [], entities: [], variables: [], computedValues: [], stateGroups: [], items: [], synthSounds: [], mediaAssets: [],
    ...overrides,
  };
}
