import type { WorkerMutationValidator } from "./validationTypes";
import { object } from "./validationHelpers";
import { validateSynth } from "../../src/features/media/synth";
import type { SynthSound } from "../../src/features/media/model";

function synthSound(value: unknown): value is SynthSound {
  if (!object(value)
    || typeof value.id !== "string"
    || typeof value.key !== "string"
    || typeof value.label !== "string"
    || typeof value.tempo !== "number"
    || typeof value.loop !== "boolean"
    || !Array.isArray(value.voices)) return false;
  return value.voices.every((voice) => object(voice)
    && ["square", "triangle", "sawtooth", "sine", "noise"].includes(String(voice.waveform))
    && typeof voice.attack === "number"
    && typeof voice.release === "number"
    && Array.isArray(voice.steps)
    && voice.steps.every((step) => object(step)
      && typeof step.active === "boolean"
      && typeof step.note === "string"
      && typeof step.volume === "number"));
}

export const mediaMutationValidator: WorkerMutationValidator = {
  types: ["synth.upsert", "mediaAsset.upsert", "mediaAsset.delete"],
  validate(operation) {
    if (operation.type === "synth.upsert") {
      if (!synthSound(operation.sound)) return "Synth sound is invalid.";
      if (typeof operation.sound.id !== "string" || !operation.sound.id || typeof operation.sound.label !== "string" || !operation.sound.label.trim()) return "Synth sound identity is invalid.";
      const errors = validateSynth(operation.sound);
      if (errors.length) return errors[0];
    }
    if (operation.type === "mediaAsset.upsert") {
      const asset = operation.asset;
      if (!object(asset)) return "Media asset is invalid.";
      if (typeof asset.id !== "string" || !asset.id || typeof asset.name !== "string" || !asset.name.trim()) return "Media asset identity is invalid.";
      if (typeof asset.kind !== "string" || !['audio', 'image'].includes(asset.kind) || asset.source !== "embedded") return "Media asset type is invalid.";
      if (typeof asset.dataUrl !== "string" || !asset.dataUrl.startsWith("data:") || asset.dataUrl.length > 1_500_000) return "Media asset data is invalid or too large.";
      if (typeof asset.mimeType !== "string" || !asset.mimeType.includes("/")) return "Media asset MIME type is invalid.";
      if (typeof asset.size !== "number" || !Number.isInteger(asset.size) || asset.size < 0 || asset.size > 1_000_000) return "Media asset must be no larger than 1 MB.";
    }
    return null;
  },
};
