import type { AuthorFeatureManifest } from "../../../author/features/types";
import { configuredAssetStore } from "../ui/assetStore";
import { AssetExplorer } from "./AssetExplorer";
import { MediaAssetEditor } from "./MediaAssetEditor";
import { VectorAssetEditor } from "./VectorAssetEditor";
import { SynthEditor, SynthPanel } from "./SynthPanel";
import { mediaImageCreateWorkspace } from "./imageCreateWorkspace";
import { mediaAuthorSearch, mediaAuthorTools } from "./tools";
import { mediaSearchDocuments } from "./search";
import { audioEffectAdapter, artEffectAdapter, synthEffectAdapter } from "./ruleAdapters";
import { MEDIA_TEXT_CUE_AUTHOR_ADAPTERS } from "./textCueAdapters";

function routeDimension(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const mediaAuthorFeature: AuthorFeatureManifest = {
  id: "media",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "media") return null;
    if (route.workspace === "assets") return "Media assets";
    if (route.workspace === "synth") return "Synth sounds";
    if (route.workspace === "image-create") return "New image";
    if (route.workspace === "asset" || route.workspace === "vector-asset") {
      const asset = configuredAssetStore.resolve(snapshot, route.data?.assetId ?? "");
      return asset?.name || (route.workspace === "vector-asset" ? "New vector" : "Repository Media");
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
  workspaces: [mediaImageCreateWorkspace],
  resources: [
    {
      kind: "synth-sound",
      label: "Synth Sound",
      pluralLabel: "Synth Sounds",
      list: (snapshot) => snapshot.synthSounds.map((sound) => ({
        id: sound.id,
        value: sound.id,
        label: sound.label || sound.key || "Untitled sound",
        detail: `${sound.key} · D1 synth`,
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
    {
      // Reference-only union used by the generic Play sound effect. The effect
      // does not need to know which storage/rendering implementation owns it.
      kind: "media-sound",
      label: "Sound",
      pluralLabel: "Sounds",
      searchable: false,
      list: (snapshot) => [
        ...snapshot.synthSounds.map((sound) => ({
          id: sound.id,
          value: sound.id,
          label: sound.label || sound.key || "Untitled sound",
          detail: "synth · D1",
        })),
        ...configuredAssetStore.list(snapshot, "audio")
          .filter((asset) => asset.available && asset.contentSource === "repository")
          .map((asset) => ({
            id: asset.id,
            value: asset.id,
            label: asset.name,
            detail: `${asset.mimeType} · repository file`,
          })),
      ],
      createRoute: () => ({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: "new", resourceTask: "media-sound" },
      }),
    },
    {
      kind: "media-audio",
      label: "Audio File",
      pluralLabel: "Audio Files",
      list: (snapshot) => configuredAssetStore.list(snapshot, "audio")
        .filter((asset) => asset.available && asset.contentSource === "repository")
        .map((asset) => ({
          id: asset.id,
          value: asset.id,
          label: asset.name,
          detail: `${asset.mimeType} · repository file`,
        })),
      editRoute: (resource) => ({
        type: "feature",
        feature: "media",
        workspace: "asset",
        data: { kind: "audio", assetId: resource.id, resourceTask: "media-audio" },
      }),
    },
    {
      kind: "media-image",
      label: "Image",
      pluralLabel: "Images",
      list: (snapshot) => configuredAssetStore.list(snapshot, "image")
        .filter((asset) => asset.available)
        .map((asset) => ({
          id: asset.id,
          value: asset.id,
          label: asset.name,
          detail: `${asset.mimeType} · ${asset.contentSource === "database" ? "D1 generated" : "repository file"}`,
        })),
      createRoute: () => ({
        type: "feature",
        feature: "media",
        workspace: "image-create",
        data: { resourceTask: "media-image" },
      }),
      editRoute: (resource) => ({
        type: "feature",
        feature: "media",
        workspace: "asset",
        data: { kind: "image", assetId: resource.id, resourceTask: "media-image" },
      }),
    },
  ],
  terminalShortcuts: [
    { commands: ["/assets", "assets"], route: { type: "feature", feature: "media", workspace: "assets" } },
    { commands: ["/sounds", "sounds"], route: { type: "feature", feature: "media", workspace: "synth" } },
  ],
  renderWorkspace(route, context) {
    if (route.type === "feature" && route.feature === "media" && route.workspace === "assets") return <AssetExplorer
      snapshot={context.snapshot}
      onClose={context.leaveCurrentTask}
      onOpenAsset={(assetId, kind, authoringMode) => context.pushTask({
        type: "feature",
        feature: "media",
        workspace: authoringMode === "vector-grid" ? "vector-asset" : "asset",
        data: { assetId, kind },
      })}
      onNewVector={() => context.pushTask({ type: "feature", feature: "media", workspace: "image-create" })}
      onOpenReference={(targetRoute) => context.pushTask(targetRoute)}
    />;

    if (route.type === "feature" && route.feature === "media" && route.workspace === "asset") {
      const kind = route.data?.kind === "image" ? "image" : "audio";
      const initial = route.data?.assetId
        ? configuredAssetStore.resolve(context.snapshot, route.data.assetId) ?? undefined
        : undefined;
      const resourceKind = route.data?.resourceTask;
      const saveResource = async (operations: Parameters<typeof context.persist>[0], description: string) => {
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
      };

      if (kind === "image" && initial?.authoringMode === "vector-grid") return <VectorAssetEditor
        snapshot={context.snapshot}
        initial={initial}
        authorToken={context.authorToken}
        setWorkspaceDirty={context.setWorkspaceDirty}
        onCancel={context.leaveCurrentTask}
        onSave={saveResource}
      />;

      return <MediaAssetEditor
        snapshot={context.snapshot}
        kind={kind}
        initial={initial}
        setWorkspaceDirty={context.setWorkspaceDirty}
        onCancel={context.leaveCurrentTask}
        onSave={saveResource}
      />;
    }

    if (route.type === "feature" && route.feature === "media" && route.workspace === "vector-asset") {
      const initial = route.data?.assetId
        ? configuredAssetStore.resolve(context.snapshot, route.data.assetId) ?? undefined
        : undefined;
      const resourceKind = route.data?.resourceTask;
      return <VectorAssetEditor
        snapshot={context.snapshot}
        initial={initial}
        initialWidth={routeDimension(route.data?.vectorWidth)}
        initialHeight={routeDimension(route.data?.vectorHeight)}
        authorToken={context.authorToken}
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
      const resourceTask = route.data?.resourceTask;
      return <SynthEditor
        snapshot={context.snapshot}
        initial={sound}
        onSave={async (operations, description) => {
          const result = await context.persist(operations, description);
          if (resourceTask && (result.status === "saved" || result.status === "queued")) {
            const operation = operations.find((candidate) => candidate.type === "synth.upsert");
            if (operation?.type === "synth.upsert") context.completeTask({
              type: "resource",
              kind: resourceTask,
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