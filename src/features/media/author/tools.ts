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
      description: "Browse repository Media, draw vectors, and audit stable asset references.",
      searchText: "image images sound sounds file files media sprite art audio svg vector draw asset repository",
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
      description: "Create and edit synthesized system sounds stored with project data.",
      searchText: "synth system sound chirp bleep audio voice waveform note sequence step tempo attack release advanced",
      onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "synth" }),
    },
  },
];

export const mediaAuthorSearch: AuthorSearchContributor = (context) => [
  {
    id: "media:synth-controls",
    groupLabel: "WORLD + MEDIA",
    label: "SYNTH · SIMPLE + ADVANCED",
    description: "Start with a system-sound preset, then shape voices, waveforms, sequence length, notes, and envelopes.",
    searchText: "system sound chirp bleep audio recipe synth label loop tempo voice voices waveform square triangle sine saw noise attack release step steps note notes pitch sequence advanced preset blip chime alert hit",
    onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "synth" }),
  },
  {
    id: "media:asset-library",
    groupLabel: "WORLD + MEDIA",
    label: "MEDIA ASSETS",
    description: "Browse repository files or draw scalable 32×32 vector assets behind stable project IDs.",
    searchText: "asset assets audio sound image art sprite repository file svg vector draw grid export",
    onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "assets" }),
  },
];