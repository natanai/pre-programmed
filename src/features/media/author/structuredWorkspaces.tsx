import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { configuredAssetStore } from "../ui/assetStore";
import { AssetExplorer } from "./AssetExplorer";
import { mediaFileAssetWorkspace, mediaFileHelpWorkspace } from "./mediaAssetWorkspace";
import { synthSoundWorkspace } from "./synthSoundWorkspace";
import { vectorAssetWorkspace } from "./vectorAssetWorkspace";
import "./mediaAuthor.css";

export const mediaAssetsWorkspace = defineAuthorWorkspace({
  id: "media-assets",
  matches: (route) => route.type === "feature" && route.feature === "media" && route.workspace === "assets",
  createDraft: () => ({}),
  buildSpec: ({ context }) => {
    const assets = configuredAssetStore.list(context.snapshot);
    return {
      id: "media-assets",
      title: "Media assets",
      context: `${assets.length} asset${assets.length === 1 ? "" : "s"}`,
      blocks: [{
        type: "custom",
        id: "media-assets-explorer",
        role: "specialized-control",
        content: <AssetExplorer
          snapshot={context.snapshot}
          onOpenAsset={(assetId, kind, authoringMode) => context.pushTask({
            type: "feature",
            feature: "media",
            workspace: authoringMode === "vector-grid" ? "vector-asset" : "asset",
            data: { assetId, kind },
          })}
          onNewVector={() => context.pushTask({
            type: "feature",
            feature: "media",
            workspace: "vector-asset",
            data: { kind: "image" },
          })}
          onOpenReference={(route) => context.pushTask(route)}
        />,
      }],
    };
  },
});

export const mediaSynthLibraryWorkspace = defineAuthorWorkspace({
  id: "media-synth-library",
  matches: (route) => route.type === "feature" && route.feature === "media" && route.workspace === "synth",
  createDraft: () => ({}),
  buildSpec: ({ context }) => {
    const synths = context.snapshot.synthSounds;
    return {
      id: "media-synth-library",
      title: "Synths",
      context: `${synths.length} Synth${synths.length === 1 ? "" : "s"}`,
      blocks: [
        ...(synths.length ? [{
          type: "list" as const,
          id: "media-synth-list",
          label: "Synths",
          items: synths.map((synth) => ({
            id: `media-synth:${synth.id}`,
            label: synth.label || synth.key || "Untitled Synth",
            detail: `${synth.voices.length} voice${synth.voices.length === 1 ? "" : "s"} · ${synth.tempo} BPM`,
            onAction: () => context.pushTask({
              type: "feature",
              feature: "media",
              workspace: "synth-sound",
              data: { soundId: synth.id },
            }),
          })),
        }] : [{
          type: "status" as const,
          id: "media-synth-empty",
          text: "NO SYNTHS YET.",
        }]),
      ],
      actions: [{
        id: "media-synth-create",
        label: "+ SYNTH",
        onAction: () => context.pushTask({
          type: "feature",
          feature: "media",
          workspace: "synth-sound",
          data: { soundId: "new" },
        }),
      }],
    };
  },
});

export const MEDIA_STRUCTURED_WORKSPACES = [
  mediaAssetsWorkspace,
  mediaSynthLibraryWorkspace,
  synthSoundWorkspace,
  mediaFileAssetWorkspace,
  mediaFileHelpWorkspace,
  vectorAssetWorkspace,
] as const;
