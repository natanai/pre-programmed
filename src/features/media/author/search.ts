import type { SearchDocumentContribution } from "../../../author/search/types";

export const mediaSearchDocuments: SearchDocumentContribution = (snapshot) =>
  [
    ...snapshot.synthSounds.map((sound) => ({
      id: sound.id,
      kind: "synth",
      label: sound.label,
      searchText: `${sound.key} ${sound.label} ${sound.tempo} ${sound.loop ? "loop" : ""} ${JSON.stringify(sound.voices)}`,
    })),
    ...snapshot.mediaAssets.map((asset) => ({
      id: asset.id,
      kind: `media-${asset.kind}`,
      label: asset.name,
      searchText: `${asset.name} ${asset.kind} ${asset.mimeType} embedded ${asset.width ?? ""} ${asset.height ?? ""}`,
    })),
  ];
