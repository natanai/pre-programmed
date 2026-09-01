import type { SearchDocumentContribution } from "../../../author/search/types";

export const mediaSearchDocuments: SearchDocumentContribution = (snapshot) =>
  snapshot.synthSounds.map((sound) => ({
    id: sound.id,
    kind: "synth",
    label: sound.label,
    searchText: `${sound.key} ${sound.label}`,
  }));
