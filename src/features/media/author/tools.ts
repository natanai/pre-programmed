import type { AuthorToolContributor } from "../../../author/tools/types";
import type { AuthorSearchContributor } from "../../../author/search/types";

export const mediaAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "media",
    groupLabel: "WORLD + MEDIA",
    groupOrder: 30,
    toolOrder: 20,
    tool: {
      id: "assets",
      label: "ASSETS",
      description: "Browse detected repository art and audio.",
      searchText: "image images sound sounds file files upload embedded media sprite art audio",
      onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "assets" }),
    },
  },
  {
    groupId: "media",
    groupLabel: "WORLD + MEDIA",
    groupOrder: 30,
    toolOrder: 30,
    tool: {
      id: "sound",
      label: "SOUND",
      description: "Create and edit synthesized sounds.",
      searchText: "synth music audio voice waveform note sequence step tempo attack release volume advanced",
      onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "synth" }),
    },
  },
];

export const mediaAuthorSearch: AuthorSearchContributor = (context) => [
  {
    id: "media:synth-controls",
    groupLabel: "WORLD + MEDIA",
    label: "SYNTH · SIMPLE + ADVANCED",
    description: "Start with a preset, then edit voices, waveforms, sequence length, notes, envelopes, and volume.",
    searchText: "sound music audio recipe synth label loop tempo voice voices waveform square triangle sine saw noise attack release step steps note notes volume sequence advanced preset blip chime alert hit",
    onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "synth" }),
  },
  {
    id: "media:asset-library",
    groupLabel: "WORLD + MEDIA",
    label: "MEDIA ASSETS",
    description: "Find or create stable project sounds and images.",
    searchText: "asset assets audio sound image art sprite upload embedded repository file",
    onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "assets" }),
  },
];
