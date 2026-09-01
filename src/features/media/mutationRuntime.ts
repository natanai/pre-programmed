import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertSynth: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "synth.upsert") return;
  snapshot.synthSounds = upsertById(snapshot.synthSounds, operation.sound);
};

export const MEDIA_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "synth.upsert": upsertSynth,
};
