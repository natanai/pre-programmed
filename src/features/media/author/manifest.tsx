import type { AuthorFeatureManifest } from "../../../author/features/types";
import type { AuthorResourceOption } from "../../../author/resources/types";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../ui/assetStore";
import { AssetExplorer } from "./AssetExplorer";
import { MediaAssetEditor } from "./MediaAssetEditor";
import { MediaImageReferencePreview } from "./MediaImageReferencePreview";
import { VectorAssetEditor } from "./VectorAssetEditor";
import { SynthEditor, SynthPanel } from "./SynthPanel";
import { mediaAuthorSearch, mediaAuthorTools } from "./tools";
import { mediaSearchDocuments } from "./search";
import { audioEffectAdapter, artEffectAdapter, synthEffectAdapter } from "./ruleAdapters";
import { MEDIA_TEXT_CUE_AUTHOR_ADAPTERS } from "./textCueAdapters";

function routeDimension(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function mediaSoundEditRoute(resource: AuthorResourceOption, snapshot: ProjectSnapshot): AuthorTaskRoute {
  if (snapshot.synthSounds.some((sound) => sound.id === resource.id)) return {
    type: "feature",
    feature: "media",
    workspace: "synth-sound",
    data: { soundId: resource.id, resourceTask: "media-sound" },
  };
  return {
    type: "feature",
    feature: "media",
    workspace: "asset",
    data: { kind: "audio", assetId: resource.id, resourceTask: "media-sound" },
  };
}

export const mediaAuthorFeature: AuthorFeatureManifest = {
  id: "media",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "media") return null;
    if (route.workspace === "assets") return "Media assets";
    if (route.workspace === "synth") return "Synth sounds";
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
      editRoute: mediaSoundEditRoute,
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
      preview: (resource, snapshot, onEdit) => <MediaImageReferencePreview snapshot={snapshot} assetId={resource.id} onEdit={onEdit} />,
      createRoute: () => ({
        type: "feature",
        feature: "media",
        workspace: "vector-asset",
        data: { kind: "image", resourceTask: "media-image" },
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
      onNewVector={() => context.pushTask({ type: "feature", feature: "media", workspace: "vector-asset", data: { kind: "image" } })}
      onOpenReference={(targetRoute) => context.pushTask(targetRoute)}
    />;

    if (route.type === "feature" && route.feature === "media" && route.workspace === "asset") {
      const kind = route.data?.kind === "image" ? "image" : "audio";
      const initial = route.data?.assetId
        ? configuredAssetStore.resolve(context.snapshot, route.data.assetId) ?? undefined
        : undefined;
      const resourceKind = route.data?.resourceTask;
      return <MediaAssetEditor
        authorToken={context.authorToken}
        kind={kind}
        initialAsset={initial}
        onSaved={(asset) => {
          context.onSnapshot({
            ...context.snapshot,
            mediaAssets: context.snapshot.mediaAssets.some((candidate) => candidate.id === asset.id)
              ? context.snapshot.mediaAssets.map((candidate) => candidate.id === asset.id ? asset : candidate)
              : [...context.snapshot.mediaAssets, asset],
          });
          if (resourceKind) context.completeTask({ type: "resource", kind: resourceKind, id: asset.id, value: asset.id, label: asset.name });
        }}
        onDelete={(assetId) => {
          context.onSnapshot({
            ...context.snapshot,
            mediaAssets: context.snapshot.mediaAssets.filter((candidate) => candidate.id !== assetId),
          });
          context.leaveCurrentTask();
        }}
        onClose={context.leaveCurrentTask}
      />;
    }

    if (route.type === "feature" && route.feature === "media" && route.workspace === "vector-asset") return <VectorAssetEditor
      authorToken={context.authorToken}
      snapshot={context.snapshot}
      assetId={route.data?.assetId}
      width={routeDimension(route.data?.width)}
      height={routeDimension(route.data?.height)}
      resourceTask={route.data?.resourceTask}
      onSaved={(snapshot) => context.onSnapshot(snapshot)}
      onComplete={(result) => context.completeTask(result)}
      onClose={context.leaveCurrentTask}
    />;

    if (route.type === "feature" && route.feature === "media" && route.workspace === "synth") return <SynthPanel
      snapshot={context.snapshot}
      authorToken={context.authorToken}
      onSnapshot={context.onSnapshot}
      onClose={context.leaveCurrentTask}
    />;

    if (route.type === "feature" && route.feature === "media" && route.workspace === "synth-sound") return <SynthEditor
      snapshot={context.snapshot}
      authorToken={context.authorToken}
      soundId={route.data?.soundId}
      resourceTask={route.data?.resourceTask}
      onSnapshot={context.onSnapshot}
      onComplete={(result) => context.completeTask(result)}
      onClose={context.leaveCurrentTask}
    />;

    return null;
  },
};
