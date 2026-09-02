import { useEffect, useMemo, useState } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import { referencesTo } from "../../../author/references/projectReferences";
import { createMediaAsset } from "../assets";
import type { MediaAsset, MediaAssetKind } from "../model";
import { configuredAssetContentStore, configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import "./mediaAuthor.css";

const MAX_ASSET_BYTES = 20_000_000;

function imageDimensions(file: Blob) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export function MediaAssetEditor({ snapshot, kind, initial, authorToken, onSave, onCancel, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  kind: MediaAssetKind;
  initial?: MediaAsset;
  authorToken: string;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<MediaAsset | null>(() => initial ? structuredClone(initial) : null);
  const [pendingContent, setPendingContent] = useState<File | null>(null);
  const [uploadedContentKey, setUploadedContentKey] = useState<string | null>(null);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial ?? null));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = Boolean(pendingContent) || JSON.stringify(draft) !== baseline;
  const usages = initial ? referencesTo(snapshot, `media-${initial.kind}`, initial.id) : [];
  const hasProjectMetadata = Boolean(initial && snapshot.mediaAssets.some((asset) => asset.id === initial.id));
  const repositoryMetadata = draft ? configuredAssetContentStore.repositoryMetadata(draft.id) : null;
  const repositoryAvailable = Boolean(repositoryMetadata);

  const previewUrl = useMemo(() => {
    if (pendingContent) return URL.createObjectURL(pendingContent);
    if (!draft) return "";
    return configuredAssetContentStore.urlFor(draft);
  }, [pendingContent, draft?.id, draft?.contentKey]);

  useEffect(() => () => {
    if (pendingContent && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [pendingContent, previewUrl]);

  useEffect(() => {
    setWorkspaceDirty(dirty);
    return () => setWorkspaceDirty(false);
  }, [dirty, setWorkspaceDirty]);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    const fileKind: MediaAssetKind = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : kind;
    if (fileKind !== kind) {
      setError(`Choose ${kind === "audio" ? "an audio" : "an image"} file.`);
      return;
    }
    if (file.size > MAX_ASSET_BYTES) {
      setError("Assets are currently limited to 20 MB each.");
      return;
    }
    const dimensions = kind === "image" ? await imageDimensions(file) : null;
    const contentKey = crypto.randomUUID();
    setDraft(createMediaAsset({
      id: initial?.id ?? draft?.id,
      name: draft?.name || file.name,
      mimeType: file.type || (kind === "image" ? "image/png" : "audio/mpeg"),
      contentKey,
      byteLength: file.size,
      intrinsicWidth: dimensions?.width ?? null,
      intrinsicHeight: dimensions?.height ?? null,
      defaultPresentation: draft?.defaultPresentation ?? "overlay",
      authoringMode: "file",
    }));
    setPendingContent(file);
    setUploadedContentKey(null);
    setError("");
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      if (pendingContent) {
        if (!draft.contentKey) throw new Error("Asset content has no content key.");
        if (uploadedContentKey !== draft.contentKey) {
          await configuredAssetContentStore.upload(authorToken, draft.contentKey, pendingContent);
          setUploadedContentKey(draft.contentKey);
        }
      }
      const result = await onSave(
        [{ type: "mediaAsset.upsert", asset: draft }],
        `${initial ? "Changed" : "Added"} media asset ${draft.name}`,
      );
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify(draft));
        setPendingContent(null);
        setUploadedContentKey(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Asset save failed.");
    } finally {
      setSaving(false);
    }
  };

  const resetOrDelete = async () => {
    if (!initial || !hasProjectMetadata) return;
    const resetting = repositoryAvailable;
    if (!resetting && usages.length) return;
    const prompt = resetting
      ? `Reset media asset “${initial.name}” to its repository definition?`
      : `Delete media asset “${initial.name}”?`;
    if (!window.confirm(prompt)) return;
    setSaving(true);
    try {
      const result = await onSave(
        [{ type: "mediaAsset.delete", id: initial.id }],
        resetting ? `Reset media asset ${initial.name} to repository copy` : `Deleted media asset ${initial.name}`,
      );
      if (result.status === "saved" || result.status === "queued") onCancel();
    } finally { setSaving(false); }
  };

  const useRepositoryCopy = () => {
    if (!draft || !repositoryMetadata) return;
    setDraft({
      ...draft,
      contentKey: null,
      ...repositoryMetadata,
    });
    setPendingContent(null);
    setUploadedContentKey(null);
  };

  const exportAsset = async () => {
    if (!draft || dirty) return;
    const resolved = configuredAssetStore.resolve(snapshot, draft.id);
    if (!resolved) return;
    setError("");
    try { await configuredAssetContentStore.exportAsset(resolved); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Asset export failed."); }
  };

  const lifecycleLabel = repositoryAvailable ? "RESET TO REPOSITORY" : "DELETE";
  const lifecycleDisabled = saving || (!repositoryAvailable && usages.length > 0);

  return <section className="author-panel author-panel-frame media-asset-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>{kind === "audio" ? "SOUND" : "IMAGE"} ASSET · {draft?.name ?? "NEW"}</span></header>
    <div className="author-panel-body">
      <p className="field-help">Assets keep a stable project ID. File bytes live behind the Media content store, so authored references never contain repository paths or data URLs.</p>
      <label>FILE <input type="file" accept={kind === "audio" ? "audio/*" : "image/*"} onChange={(event) => void chooseFile(event.target.files?.[0])} /></label>
      <small>Files are currently limited to 20 MB.</small>
      {draft ? <>
        <label>NAME <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        {kind === "image" ? <label>DEFAULT PLAYER PRESENTATION
          <select value={draft.defaultPresentation} onChange={(event) => setDraft({ ...draft, defaultPresentation: event.target.value === "inline" ? "inline" : "overlay" })}>
            <option value="inline">inline / icon</option>
            <option value="overlay">large art / overlay</option>
          </select>
          <small>This is independent of the file's pixel or SVG coordinate dimensions.</small>
        </label> : null}
        <div className="media-asset-preview">
          {previewUrl ? kind === "audio" ? <audio controls src={previewUrl} /> : <img src={previewUrl} alt="Asset preview" /> : <span>CONTENT NEEDS TO BE RE-UPLOADED.</span>}
        </div>
        <small>{draft.mimeType} · {draft.byteLength} bytes{draft.intrinsicWidth && draft.intrinsicHeight ? ` · intrinsic ${draft.intrinsicWidth}×${draft.intrinsicHeight}` : ""}</small>
      </> : null}
      {error ? <div className="author-message" role="alert">{error}</div> : null}
    </div>
    <div className="author-actions author-panel-footer">
      <button type="button" disabled={!draft || !dirty || saving || !draft.name.trim() || (!draft.contentKey && !pendingContent && !repositoryAvailable)} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE ASSET"}]</button>
      {initial ? <button type="button" disabled={saving || dirty} title={dirty ? "Save changes before exporting." : undefined} onClick={() => void exportAsset()}>[EXPORT + ID]</button> : null}
      {draft?.contentKey && repositoryAvailable ? <button type="button" disabled={saving} onClick={useRepositoryCopy}>[USE REPOSITORY COPY]</button> : null}
      <button type="button" onClick={onCancel}>[CANCEL]</button>
      {initial && hasProjectMetadata ? <button
        type="button"
        className="danger"
        disabled={lifecycleDisabled}
        title={!repositoryAvailable && usages.length ? `Used by ${usages.map((usage) => usage.ownerLabel).join(", ")}` : undefined}
        onClick={() => void resetOrDelete()}
      >[{lifecycleLabel}{!repositoryAvailable && usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}]</button> : null}
    </div>
  </section>;
}
