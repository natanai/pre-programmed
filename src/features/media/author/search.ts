import type { SearchDocumentContribution } from "../../../author/search/types";

export const mediaSearchDocuments: SearchDocumentContribution = (snapshot) =>
  [
    ...snapshot.synthSounds.map((sound) => ({
      id: sound.id,
      kind: "synth",
      label: sound.label,
      searchText: `${sound.key} ${sound.label} ${sound.tempo} ${sound.loop ? "loop" : ""} ${JSON.stringify(sound.voices)}`,
    })),
    ...(snapshot.mediaCompositions ?? []).map((composition) => ({
      id: composition.id,
      kind: "media-sound",
      label: composition.title,
      searchText: composition.title + " " + composition.bpm + " BPM " + composition.instruments.map((instrument) => instrument.name + " " + instrument.chunks.map((chunk) => chunk.name).join(" ")).join(" "),
    })),
    ...snapshot.mediaAssets.map((asset) => ({
      id: asset.id,
      kind: `media-${asset.kind}`,
      label: asset.name,
      searchText: `${asset.name} ${asset.kind} ${asset.mimeType} ${asset.defaultPresentation} ${asset.authoringMode} ${asset.intrinsicWidth ?? ""} ${asset.intrinsicHeight ?? ""}`,
    })),
  ];
