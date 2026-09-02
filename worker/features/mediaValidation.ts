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

function optionalDimension(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value > 0);
}

export const mediaMutationValidator: WorkerMutationValidator = {
  types: ["synth.upsert", "synth.delete", "mediaAsset.upsert", "mediaAsset.delete"],
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
      if (typeof asset.kind !== "string" || !["audio", "image"].includes(asset.kind)) return "Media asset type is invalid.";
      if (typeof asset.mimeType !== "string" || !asset.mimeType.includes("/")) return "Media asset MIME type is invalid.";
      if (asset.contentKey !== null && (typeof asset.contentKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(asset.contentKey))) return "Media asset content key is invalid.";
      if (typeof asset.byteLength !== "number" || !Number.isInteger(asset.byteLength) || asset.byteLength < 0 || asset.byteLength > 20_000_000) return "Media asset must be no larger than 20 MB.";
      if (!optionalDimension(asset.intrinsicWidth) || !optionalDimension(asset.intrinsicHeight)) return "Media asset dimensions are invalid.";
      if (!["inline", "overlay"].includes(String(asset.defaultPresentation))) return "Media asset presentation is invalid.";
      if (!["file", "grid32"].includes(String(asset.authoringMode))) return "Media asset authoring mode is invalid.";
    }
    if (operation.type === "synth.delete") {
      return typeof operation.id === "string" && operation.id ? null : "Synth sound id is required.";
    }
    if (operation.type === "mediaAsset.delete") {
      return typeof operation.id === "string" && operation.id ? null : "Media asset id is required.";
    }
    return null;
  },
};
