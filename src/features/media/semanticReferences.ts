import type { SemanticReferenceProvider } from "../../engine/references/types";

export const MEDIA_SEMANTIC_REFERENCE_PROVIDERS: readonly SemanticReferenceProvider[] = [
  {
    kind: "media.image",
    label: "Images",
    description: "Authored image assets stored in the project Media catalog.",
    authorSyntax: "image",
    authorResourceKind: "media-image",
    defaultProjection: "name",
    candidates: ({ snapshot }) => snapshot.mediaAssets.filter((asset) => asset.kind === "image").map((asset) => ({
      id: asset.id,
      key: asset.name || asset.id,
      label: asset.name || asset.id,
      detail: asset.mimeType,
      aliases: [asset.name].filter(Boolean),
      defaultProjection: "name",
      projections: { name: asset.name, mimeType: asset.mimeType },
      author: { resourceKind: "media-image", resourceId: asset.id },
    })),
    projectResource: (id, snapshot) => snapshot.mediaAssets.some((asset) => asset.id === id && asset.kind === "image")
      ? { resourceKind: "media-image", resourceId: id }
      : null,
  },
  {
    kind: "media.audio",
    label: "Audio files",
    description: "Repository audio assets stored in the project Media catalog.",
    authorSyntax: "audio",
    authorResourceKind: "media-audio",
    defaultProjection: "name",
    candidates: ({ snapshot }) => snapshot.mediaAssets.filter((asset) => asset.kind === "audio").map((asset) => ({
      id: asset.id,
      key: asset.name || asset.id,
      label: asset.name || asset.id,
      detail: asset.mimeType,
      aliases: [asset.name].filter(Boolean),
      defaultProjection: "name",
      projections: { name: asset.name, mimeType: asset.mimeType },
      author: { resourceKind: "media-audio", resourceId: asset.id },
    })),
    projectResource: (id, snapshot) => snapshot.mediaAssets.some((asset) => asset.id === id && asset.kind === "audio")
      ? { resourceKind: "media-audio", resourceId: id }
      : null,
  },
  {
    kind: "media.synth",
    label: "Synths",
    description: "Authored procedural Synth definitions.",
    authorSyntax: "synth",
    authorResourceKind: "synth-sound",
    defaultProjection: "label",
    candidates: ({ snapshot }) => snapshot.synthSounds.map((synth) => ({
      id: synth.id,
      key: synth.key,
      label: synth.label || synth.key,
      detail: `${synth.tempo} BPM`,
      aliases: [synth.label, synth.key].filter(Boolean),
      defaultProjection: "label",
      projections: { label: synth.label || synth.key, key: synth.key },
      author: { resourceKind: "synth-sound", resourceId: synth.id },
    })),
    projectResource: (id, snapshot) => snapshot.synthSounds.some((synth) => synth.id === id)
      ? { resourceKind: "synth-sound", resourceId: id }
      : null,
  },
];
