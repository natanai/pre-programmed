import type { WorkerMutationValidator } from "./validationTypes";
import { object } from "./validationHelpers";

export const mediaMutationValidator: WorkerMutationValidator = {
  types: ["synth.upsert", "mediaAsset.upsert", "mediaAsset.delete"],
  validate(operation) {
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
