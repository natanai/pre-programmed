import type { AuthorFeatureManifest } from "../../../author/features/types";
import type { AuthorResourceOption } from "../../../author/resources/types";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { configuredAssetStore } from "../ui/assetStore";
import { MediaImageReferencePreview } from "./MediaImageReferencePreview";
import { mediaAuthorSearch, mediaAuthorTools } from "./tools";
import { mediaSearchDocuments } from "./search";
import { audioEffectAdapter, artEffectAdapter, synthEffectAdapter } from "./ruleAdapters";
import { MEDIA_TEXT_CUE_AUTHOR_ADAPTERS } from "./textCueAdapters";
import { MEDIA_STRUCTURED_WORKSPACES } from "./structuredWorkspaces";

function mediaSoundEditRoute(resource: AuthorResourceOption, snapshot: ProjectSnapshot): AuthorTaskRoute {
  if (snapshot.synthSounds.some((synth) => synth.id === resource.id)) return {
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

function mediaImageEditRoute(resource: AuthorResourceOption, snapshot: ProjectSnapshot): AuthorTaskRoute {
  const asset = configuredAssetStore.resolve(snapshot, resource.id);
  return {
    type: "feature",
    feature: "media",
    workspace: asset?.authoringMode === "vector-grid" ? "vector-asset" : "asset",
    data: { kind: "image", assetId: resource.id, resourceTask: "media-image" },
  };
}

export const mediaAuthorFeature: AuthorFeatureManifest = {
  id: "media",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "media") return null;
    if (route.workspace === "assets") return "Media assets";
    if (route.workspace === "synth") return "Synths";
    if (route.workspace === "asset" || route.workspace === "vector-asset") {
      const asset = configuredAssetStore.resolve(snapshot, route.data?.assetId ?? "");
      return asset?.name || (route.workspace === "vector-asset" ? "New vector" : "Repository Media");
    }
    if (route.workspace === "synth-sound") {
      const synth = snapshot.synthSounds.find((candidate) => candidate.id === route.data?.soundId);
      return synth?.label || synth?.key || "New Synth";
    }
    return null;
  },
  effects: [synthEffectAdapter, audioEffectAdapter, artEffectAdapter],
  textCues: MEDIA_TEXT_CUE_AUTHOR_ADAPTERS,
  searchDocuments: [mediaSearchDocuments],
  tools: mediaAuthorTools,
  search: mediaAuthorSearch,
  workspaces: [...MEDIA_STRUCTURED_WORKSPACES],
  resources: [
    {
      kind: "synth-sound",
      label: "Synth",
      pluralLabel: "Synths",
      list: (snapshot) => snapshot.synthSounds.map((synth) => ({
        id: synth.id,
        value: synth.id,
        label: synth.label || synth.key || "Untitled Synth",
        detail: `${synth.key} · D1 procedural`,
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
      kind: "media-sound",
      label: "Audio Source",
      pluralLabel: "Audio Sources",
      searchable: false,
      list: (snapshot) => [
        ...snapshot.synthSounds.map((synth) => ({
          id: synth.id,
          value: synth.id,
          label: synth.label || synth.key || "Untitled Synth",
          detail: "Synth · D1 procedural",
        })),
        ...configuredAssetStore.list(snapshot, "audio")
          .filter((asset) => asset.available && asset.contentSource === "repository")
          .map((asset) => ({
            id: asset.id,
            value: asset.id,
            label: asset.name,
            detail: `${asset.mimeType} · repository audio`,
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
      editRoute: mediaImageEditRoute,
    },
  ],
  terminalShortcuts: [
    { commands: ["/assets", "assets"], route: { type: "feature", feature: "media", workspace: "assets" } },
    { commands: ["/synth", "synth", "/sounds", "sounds"], route: { type: "feature", feature: "media", workspace: "synth" } },
  ],
};
