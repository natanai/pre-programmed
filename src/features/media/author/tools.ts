import type { AuthorToolContributor } from "../../../author/tools/types";
import type { AuthorSearchContributor } from "../../../author/search/types";

export const mediaAuthorTools: AuthorToolContributor = (context) => [
  {
    groupId: "media",
    groupLabel: "MEDIA",
    groupOrder: 30,
    toolOrder: 20,
    tool: {
      id: "assets",
      label: "ASSETS",
      description: "Browse images and audio, draw vectors, and find broken asset links.",
      searchText: "image images sound sounds file files media sprite art audio svg vector draw asset repository",
      onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "assets" }),
    },
  },
  {
    groupId: "media",
    groupLabel: "MEDIA",
    groupOrder: 30,
    toolOrder: 30,
    tool: {
      id: "synth",
      label: "SYNTH",
      description: "Create and edit Synth sounds.",
      searchText: "synth system sound chirp bleep boot confirm error ascend zap audio voice waveform shape note sequence step tempo attack release volume advanced",
      onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "synth" }),
    },
  },
  {
    groupId: "media",
    groupLabel: "MEDIA",
    groupOrder: 30,
    toolOrder: 40,
    tool: {
      id: "compositions",
      label: "COMPOSITIONS",
      description: "Browse .premidi music discovered in the assets folder.",
      searchText: "premidi pre-midi composition soundtrack notes music midi assets arrangement pattern",
      onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "compositions" }),
    },
  },
];

export const mediaAuthorSearch: AuthorSearchContributor = (context) => [
  {
    id: "media:compositions",
    groupLabel: "MEDIA",
    label: "COMPOSITIONS · PRE-MIDI",
    description: "Find music files discovered from the project assets folder.",
    searchText: "premidi pre-midi music midi soundtrack composition arrangement assets",
    onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "compositions" }),
  },
  {
    id: "media:synth-controls",
    groupLabel: "MEDIA",
    label: "SYNTH · PALETTES + SHAPING",
    description: "Start with a Synth palette, then shape wave, envelope, steps, pitch, and optional per-step volume.",
    searchText: "system sound chirp bleep audio recipe synth label loop tempo voice voices waveform square triangle sine saw noise shape tight punch soft ring attack release step steps note notes pitch volume sequence advanced palette preset blip chirp confirm chime alert error boot ascend zap hit",
    onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "synth" }),
  },
  {
    id: "media:asset-library",
    groupLabel: "MEDIA",
    label: "MEDIA ASSETS",
    description: "Browse media files or draw vector assets.",
    searchText: "asset assets audio sound image art sprite repository file svg vector draw grid export",
    onSelect: () => context.pushTask({ type: "feature", feature: "media", workspace: "assets" }),
  },
];