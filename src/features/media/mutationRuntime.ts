import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertSynth: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "synth.upsert") return;
  snapshot.synthSounds = upsertById(snapshot.synthSounds, operation.sound);
};

const upsertAsset: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "mediaAsset.upsert") return;
  snapshot.mediaAssets = upsertById(snapshot.mediaAssets ?? [], operation.asset);
};

const deleteAsset: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "mediaAsset.delete") return;
  snapshot.mediaAssets = (snapshot.mediaAssets ?? []).filter((asset) => asset.id !== operation.id);
};

export const MEDIA_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "synth.upsert": upsertSynth,
  "mediaAsset.upsert": upsertAsset,
  "mediaAsset.delete": deleteAsset,
};
