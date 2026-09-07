import { referencesTo } from "../../../author/references/projectReferences";
import type { AuthorUiAction, AuthorUiNode } from "../../../author/ui/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { configuredAssetContentStore, configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import type { MediaAssetDescriptor } from "../assets";
import { mediaAssetDimensions, type MediaAsset } from "../model";

function persistedAsset(asset: MediaAssetDescriptor): MediaAsset {
  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    mimeType: asset.mimeType,
    contentKey: asset.contentKey,
    byteLength: asset.byteLength,
    intrinsicWidth: asset.intrinsicWidth,
    intrinsicHeight: asset.intrinsicHeight,
    defaultPresentation: asset.defaultPresentation,
    authoringMode: asset.authoringMode,
  };
}

function generatedRepositoryPath(assetId: string) {
  const prefix = "repo:/assets/";
  return assetId.startsWith(prefix) ? assetId.slice(prefix.length) : null;
}

type FileMediaWorkspaceDraft = {
  asset: MediaAsset | null;
  saving: boolean;
  error: string;
};

function signature(draft: FileMediaWorkspaceDraft) {
  return JSON.stringify(draft.asset);
}

export const mediaFileAssetWorkspace = defineAuthorWorkspace<FileMediaWorkspaceDraft>({
  id: "media-file-asset",
  matches: (route) => route.type === "feature"
    && route.feature === "media"
    && route.workspace === "asset"
    && Boolean(route.data?.assetId),
  createDraft: (route, context) => {
    const descriptor = configuredAssetStore.resolve(context.snapshot, route.data?.assetId ?? "");
    return {
      asset: descriptor ? persistedAsset(descriptor) : null,
      saving: false,
      error: "",
    };
  },
  signature,
  saveLabel: "SAVE METADATA",
  canSave: ({ context, draft }) => {
    if (!draft.asset || draft.saving || !draft.asset.name.trim()) return false;
    return configuredAssetStore.resolve(context.snapshot, draft.asset.id)?.contentSource === "repository";
  },
  save: async ({ route, context, draft, setDraft }) => {
    if (!draft.asset) return { accepted: false };
    const descriptor = configuredAssetStore.resolve(context.snapshot, draft.asset.id);
    if (descriptor?.contentSource !== "repository") return { accepted: false };
    const repositoryMetadata = configuredAssetContentStore.repositoryMetadata(draft.asset.id);
    if (!repositoryMetadata) {
      setDraft((current) => ({ ...current, error: "Repository Media metadata is unavailable." }));
      return { accepted: false };
    }

    const asset: MediaAsset = {
      ...draft.asset,
      name: draft.asset.name.trim(),
      contentKey: null,
      ...repositoryMetadata,
    };
    setDraft((current) => ({ ...current, asset, saving: true, error: "" }));
    const result = await context.persist(
      [{ type: "mediaAsset.upsert", asset }],
      `Changed repository media metadata ${asset.name}`,
    );
    if (result.status !== "saved" && result.status !== "queued") {
      setDraft((current) => ({
        ...current,
        saving: false,
        error: result.status === "conflict"
          ? "The project changed while this Media metadata was saving. Your draft is still here; save it again."
          : result.message ?? "Media metadata save failed. Your draft is still here.",
      }));
      return { accepted: false };
    }

    const resourceKind = route.data?.resourceTask;
    return {
      accepted: true,
      draft: { asset, saving: false, error: "" },
      ...(resourceKind ? {
        completion: {
          type: "resource" as const,
          kind: resourceKind,
          id: asset.id,
          value: asset.id,
          label: asset.name,
        },
      } : {}),
    };
  },
  buildSpec: ({ context, draft, setDraft, dirty }) => {
    const asset = draft.asset;
    const descriptor = asset ? configuredAssetStore.resolve(context.snapshot, asset.id) : null;
    const kind = asset?.kind ?? descriptor?.kind ?? "image";
    const repositoryAvailable = descriptor?.contentSource === "repository";
    const missingContent = descriptor?.contentSource === "missing";
    const hasProjectMetadata = Boolean(asset && context.snapshot.mediaAssets.some((candidate) => candidate.id === asset.id));
    const usages = asset ? [
      ...referencesTo(context.snapshot, `media-${asset.kind}`, asset.id),
      ...(asset.kind === "audio" ? referencesTo(context.snapshot, "media-sound", asset.id) : []),
    ] : [];
    const previewUrl = descriptor?.available ? configuredAssetContentStore.urlFor(descriptor) : "";
    const expectedRepositoryPath = asset ? generatedRepositoryPath(asset.id) : null;
    const dimensions = asset ? mediaAssetDimensions(asset) : null;
    const dimensionText = dimensions
      ? dimensions.unit === "px"
        ? `${dimensions.width}×${dimensions.height} px`
        : `${dimensions.width}×${dimensions.height} viewBox units`
      : "";

    const changeAsset = (next: MediaAsset) => setDraft((current) => ({ ...current, asset: next, error: "" }));

    const exportAsset = async () => {
      if (!asset || dirty || !repositoryAvailable) return;
      const resolved = configuredAssetStore.resolve(context.snapshot, asset.id);
      if (!resolved?.available) return;
      setDraft((current) => ({ ...current, error: "" }));
      try {
        await configuredAssetContentStore.exportAsset(resolved);
      } catch (reason) {
        setDraft((current) => ({
          ...current,
          error: reason instanceof Error ? reason.message : "Asset export failed.",
        }));
      }
    };

    const resetOrDelete = async () => {
      if (!asset || !descriptor || !hasProjectMetadata || draft.saving) return;
      const resetting = repositoryAvailable;
      if (!resetting && usages.length) return;
      const prompt = resetting
        ? `Reset media asset “${descriptor.name}” to its repository definition?`
        : `Delete missing media definition “${descriptor.name}”?`;
      if (!window.confirm(prompt)) return;
      setDraft((current) => ({ ...current, saving: true, error: "" }));
      const result = await context.persist(
        [{ type: "mediaAsset.delete", id: asset.id }],
        resetting ? `Reset media asset ${descriptor.name} to repository copy` : `Deleted missing media definition ${descriptor.name}`,
      );
      if (result.status === "saved" || result.status === "queued") {
        context.leaveCurrentTask();
        return;
      }
      setDraft((current) => ({
        ...current,
        saving: false,
        error: result.status === "conflict"
          ? "The project changed while this Media definition was being changed. Nothing was removed."
          : result.message ?? "This Media definition could not be changed.",
      }));
    };

    const blocks: AuthorUiNode[] = [];
    if (!asset) {
      blocks.push({
        type: "status",
        id: "media-file-missing-definition",
        tone: "error",
        text: "This File Media definition could not be resolved.",
      });
    } else {
      const children: AuthorUiNode[] = [{
        type: "status",
        id: "media-file-id",
        text: `STABLE MEDIA ID · ${asset.id}`,
      }];

      if (repositoryAvailable) {
        children.push({
          type: "field",
          id: "media-file-name",
          label: "Name",
          value: asset.name,
          onChange: (name) => changeAsset({ ...asset, name }),
        });
        if (kind === "image") children.push({
          type: "select",
          id: "media-file-presentation",
          label: "Default player presentation",
          value: asset.defaultPresentation,
          onChange: (value) => changeAsset({ ...asset, defaultPresentation: value === "inline" ? "inline" : "overlay" }),
          options: [
            { value: "inline", label: "INLINE / ICON" },
            { value: "overlay", label: "LARGE ART / OVERLAY" },
          ],
          help: "Independent of the file's pixel or SVG coordinate dimensions.",
        });
        children.push({
          type: "custom",
          id: "media-file-preview",
          role: "preview",
          content: <div className="media-asset-preview">
            {previewUrl
              ? kind === "audio"
                ? <audio controls src={previewUrl} />
                : <img src={previewUrl} alt="Asset preview" />
              : <span>REPOSITORY FILE UNAVAILABLE.</span>}
          </div>,
        });
        children.push({
          type: "status",
          id: "media-file-metadata",
          text: `FILE MEDIA · ${asset.mimeType} · ${asset.byteLength} bytes${dimensionText ? ` · ${dimensionText}` : ""}`,
        });
      } else if (missingContent) {
        const restore = expectedRepositoryPath
          ? ` Restore the file at assets/${expectedRepositoryPath} to recover this stable ID automatically.`
          : " Restore the intended file with an identity receipt carrying this stable ID.";
        children.push({
          type: "status",
          id: "media-file-missing-content",
          tone: "warning",
          text: `MISSING FILE MEDIA · The definition still exists, but its file content does not.${restore}${usages.length ? ` ${usages.length} authored use${usages.length === 1 ? "" : "s"} still reference it.` : ""}`,
        });
      }

      blocks.push({
        type: "section",
        id: "media-file-definition",
        label: kind === "audio" ? "Sound file" : "Image file",
        importance: "primary",
        children,
      });
    }

    if (draft.error) blocks.push({
      type: "status",
      id: "media-file-error",
      tone: "error",
      text: draft.error,
    });

    const actions: AuthorUiAction[] = [];
    if (repositoryAvailable && descriptor) actions.push({
      id: "media-file-export",
      label: "EXPORT + ID RECEIPT",
      disabled: draft.saving || dirty,
      onAction: () => { void exportAsset(); },
    });
    if (asset && descriptor && hasProjectMetadata) {
      const resetting = repositoryAvailable;
      actions.push({
        id: "media-file-lifecycle",
        label: `${resetting ? "RESET REPOSITORY METADATA" : "DELETE BROKEN DEFINITION"}${!resetting && usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}`,
        tone: "danger",
        disabled: draft.saving || (!resetting && usages.length > 0),
        onAction: () => { void resetOrDelete(); },
      });
    }

    return {
      id: "media-file-asset",
      title: `${kind === "audio" ? "Sound file" : "Image file"} · ${asset?.name ?? "Unavailable"}`,
      context: descriptor?.contentSource === "repository"
        ? "repository file"
        : descriptor?.contentSource === "missing"
          ? "missing content"
          : "file media",
      blocks,
      actions,
    };
  },
});

export const mediaFileHelpWorkspace = defineAuthorWorkspace({
  id: "media-file-help",
  matches: (route) => route.type === "feature"
    && route.feature === "media"
    && route.workspace === "asset"
    && !route.data?.assetId,
  createDraft: () => ({}),
  buildSpec: ({ route }) => ({
    id: "media-file-help",
    title: `Add ${route.data?.kind === "audio" ? "sound" : "image"} file`,
    context: "filesystem-owned content",
    blocks: [
      {
        type: "status",
        id: "media-file-help-location",
        text: "Put the file inside public/assets/ for a repository build or assets/ beside the portable executable. The engine discovers File Media from that installation folder.",
      },
      {
        type: "status",
        id: "media-file-help-id",
        text: "Author rules store only the stable Media ID. A writable portable assets folder creates a neighboring .asset.json identity receipt automatically.",
      },
    ],
  }),
});
