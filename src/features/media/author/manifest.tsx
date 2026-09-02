import type { AuthorFeatureManifest } from "../../../author/features/types";
import { configuredAssetStore } from "../ui/assetStore";
import { AssetExplorer } from "./AssetExplorer";
import { MediaAssetEditor } from "./MediaAssetEditor";
import { SynthEditor, SynthPanel } from "./SynthPanel";
import { mediaAuthorSearch, mediaAuthorTools } from "./tools";
import { mediaSearchDocuments } from "./search";
import { audioEffectAdapter, artEffectAdapter, synthEffectAdapter } from "./ruleAdapters";
import { MEDIA_TEXT_CUE_AUTHOR_ADAPTERS } from "./textCueAdapters";

export const mediaAuthorFeature: AuthorFeatureManifest = {
  id: "media",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "media") return null;
    if (route.workspace === "assets") return "Media assets";
    if (route.workspace === "synth") return "Synth sounds";
    if (route.workspace === "asset") {
      const asset = snapshot.mediaAssets.find((candidate) => candidate.id === route.data?.assetId);
      return asset?.name || `New ${route.data?.kind === "image" ? "image" : "sound"}`;
    }
    if (route.workspace === "synth-sound") {
      const sound = snapshot.synthSounds.find((candidate) => candidate.id === route.data?.soundId);
      return sound?.label || sound?.key || "New synth sound";
    }
    return null;
  },
  effects: [synthEffectAdapter, audioEffectAdapter, artEffectAdapter],
  textCues: MEDIA_TEXT_CUE_AUTHOR_ADAPTERS,
  searchDocuments: [mediaSearchDocuments],
  tools: mediaAuthorTools,
  search: mediaAuthorSearch,
  resources: [
    {
      kind: "synth-sound",
      label: "Synth Sound",
      pluralLabel: "Synth Sounds",
      list: (snapshot) => snapshot.synthSounds.map((sound) => ({
        id: sound.id,
        value: sound.id,
        label: sound.label || sound.key || "Untitled sound",
        detail: sound.key,
      })),
      createRoute: () => ({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: "new", resourceTask: "synth-sound" },
      }),
      editRoute: (resource) => ({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: resource.id, resourceTask: "synth-sound" },
      }),
    },
    ...(["audio", "image"] as const).map((kind) => ({
      kind: `media-${kind}`,
      label: kind === "audio" ? "Sound" : "Image",
      pluralLabel: kind === "audio" ? "Sounds" : "Images",
      list: (snapshot: Parameters<typeof configuredAssetStore.list>[0]) => configuredAssetStore.list(snapshot, kind).map((asset) => ({
        id: asset.id,
        value: asset.id,
        label: asset.name,
        detail: `${asset.source} · ${asset.size} bytes`,
      })),
      createRoute: () => ({
        type: "feature" as const,
        feature: "media",
        workspace: "asset",
        data: { kind, resourceTask: `media-${kind}` },
      }),
      editRoute: (resource: { id: string }) => resource.id.startsWith("repo:") ? null : ({
        type: "feature" as const,
        feature: "media",
        workspace: "asset",
        data: { kind, assetId: resource.id, resourceTask: `media-${kind}` },
      }),
    })),
  ],
  terminalShortcuts: [
    { commands: ["/assets", "assets"], route: { type: "feature", feature: "media", workspace: "assets" } },
    { commands: ["/sounds", "sounds"], route: { type: "feature", feature: "media", workspace: "synth" } },
  ],
  renderWorkspace(route, context) {
    if (route.type === "feature" && route.feature === "media" && route.workspace === "assets") return <AssetExplorer
      snapshot={context.snapshot}
      onClose={context.leaveCurrentTask}
      onOpenAsset={(assetId, kind) => context.pushTask({ type: "feature", feature: "media", workspace: "asset", data: { assetId, kind } })}
      onNewAsset={(kind) => context.pushTask({ type: "feature", feature: "media", workspace: "asset", data: { kind } })}
      onOpenReference={(targetRoute) => context.pushTask(targetRoute)}
    />;

    if (route.type === "feature" && route.feature === "media" && route.workspace === "asset") {
      const kind = route.data?.kind === "image" ? "image" : "audio";
      const initial = route.data?.assetId
        ? context.snapshot.mediaAssets.find((asset) => asset.id === route.data?.assetId)
        : undefined;
      const resourceKind = route.data?.resourceTask;
      return <MediaAssetEditor
        snapshot={context.snapshot}
        kind={kind}
        initial={initial}
        setWorkspaceDirty={context.setWorkspaceDirty}
        onCancel={context.leaveCurrentTask}
        onSave={async (operations, description) => {
          const result = await context.persist(operations, description);
          if (resourceKind && (result.status === "saved" || result.status === "queued")) {
            const operation = operations.find((candidate) => candidate.type === "mediaAsset.upsert");
            if (operation?.type === "mediaAsset.upsert") context.completeTask({
              type: "resource",
              kind: resourceKind,
              id: operation.asset.id,
              value: operation.asset.id,
              label: operation.asset.name,
            });
          }
          return result;
        }}
      />;
    }

    if (route.type === "feature" && route.feature === "media" && route.workspace === "synth") return <SynthPanel
      snapshot={context.snapshot}
      onOpenSound={(sound) => context.pushTask({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: sound.id },
      })}
      onNewSound={() => context.pushTask({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: "new" },
      })}
    />;

    if (route.type === "feature" && route.feature === "media" && route.workspace === "synth-sound") {
      const soundId = route.data?.soundId ?? "new";
      const sound = soundId === "new"
        ? undefined
        : context.snapshot.synthSounds.find((candidate) => candidate.id === soundId);
      const resourceTask = route.data?.resourceTask === "synth-sound";
      return <SynthEditor
        snapshot={context.snapshot}
        initial={sound}
        onSave={async (operations, description) => {
          const result = await context.persist(operations, description);
          if (resourceTask && (result.status === "saved" || result.status === "queued")) {
            const operation = operations.find((candidate) => candidate.type === "synth.upsert");
            if (operation?.type === "synth.upsert") context.completeTask({
              type: "resource",
              kind: "synth-sound",
              id: operation.sound.id,
              value: operation.sound.id,
              label: operation.sound.label || operation.sound.key || "Untitled sound",
            });
          }
          return result;
        }}
        onCancel={context.leaveCurrentTask}
        setWorkspaceDirty={context.setWorkspaceDirty}
      />;
    }

    return null;
  },
};
