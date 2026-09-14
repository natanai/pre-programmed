import {
  hashInitializationText,
  randomInitializationSeed,
} from "../../engine/runtime/initializationRandom";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { resolveRadixSeed } from "./algorithm";

function startupSequence(snapshot: ProjectSnapshot) {
  const startup = snapshot.settings.radix.startup;
  if (!startup.enabled) return undefined;
  return snapshot.settings.radix.sequences.find((candidate) => candidate.id === startup.sequenceId);
}

/** Resolve the one initialization seed before any seeded world feature runs. */
export function initializeRadixPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const sequence = startupSequence(snapshot);
  return {
    ...state,
    initializationSeed: sequence ? resolveRadixSeed(sequence) : randomInitializationSeed(),
  };
}

/** Older saves predate a world seed. Give them a stable migration seed without rerolling world state. */
export function reconcileRadixPlayState(_snapshot: ProjectSnapshot, state: PlayState): PlayState {
  if (Number.isFinite(state.initializationSeed) && state.initializationSeed > 0) return state;
  return {
    ...state,
    initializationSeed: hashInitializationText(`legacy-save:${state.sessionStartedAt}`),
  };
}
