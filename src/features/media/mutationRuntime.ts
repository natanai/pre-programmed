import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertSynth: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "synth.upsert") return;
  snapshot.synthSounds = upsertById(snapshot.synthSounds, operation.sound);
};

const deleteSynth: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "synth.delete") return;
  snapshot.synthSounds = snapshot.synthSounds.filter((sound) => sound.id !== operation.id);
};

const upsertAsset: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "mediaAsset.upsert") return;
  snapshot.mediaAssets = upsertById(snapshot.mediaAssets ?? [], operation.asset);
};

const deleteAsset: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "mediaAsset.delete") return;
  snapshot.mediaAssets = (snapshot.mediaAssets ?? []).filter((asset) => asset.id !== operation.id);
};

const upsertPremidi: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "premidi.upsert") return;
  snapshot.mediaCompositions = upsertById(snapshot.mediaCompositions ?? [], operation.composition);
};

const deletePremidi: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "premidi.delete") return;
  snapshot.mediaCompositions = (snapshot.mediaCompositions ?? []).filter((entry) => entry.id !== operation.id);
};

export const MEDIA_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "synth.upsert": upsertSynth,
  "synth.delete": deleteSynth,
  "mediaAsset.upsert": upsertAsset,
  "mediaAsset.delete": deleteAsset,
  "premidi.upsert": upsertPremidi,
  "premidi.delete": deletePremidi,
};
