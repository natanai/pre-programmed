import type { SemanticReferenceProvider } from "../../engine/references/types";

export const MEDIA_SEMANTIC_REFERENCE_PROVIDERS: readonly SemanticReferenceProvider[] = [
  {
    kind: "media.image",
    label: "Images",
    description: "Authored image assets stored in the project Media catalog.",
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
    description: "Authored audio assets stored in the project Media catalog.",
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
    label: "Synth sounds",
    description: "Authored synthesizer sounds.",
    authorResourceKind: "synth-sound",
    defaultProjection: "label",
    candidates: ({ snapshot }) => snapshot.synthSounds.map((sound) => ({
      id: sound.id,
      key: sound.key,
      label: sound.label || sound.key,
      detail: `${sound.tempo} BPM`,
      aliases: [sound.label, sound.key].filter(Boolean),
      defaultProjection: "label",
      projections: { label: sound.label || sound.key, key: sound.key },
      author: { resourceKind: "synth-sound", resourceId: sound.id },
    })),
    projectResource: (id, snapshot) => snapshot.synthSounds.some((sound) => sound.id === id)
      ? { resourceKind: "synth-sound", resourceId: id }
      : null,
  },
];
