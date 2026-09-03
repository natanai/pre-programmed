import { useEffect, useState } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import { referencesTo } from "../../../author/references/projectReferences";
import type { MediaAssetDescriptor } from "../assets";
import { mediaAssetDimensions, type MediaAsset, type MediaAssetKind } from "../model";
import { configuredAssetContentStore, configuredAssetStore } from "../../../platform/assets/configuredAssetStore";
import "./mediaAuthor.css";

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

export function MediaAssetEditor({ snapshot, kind, initial, onSave, onCancel, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  kind: MediaAssetKind;
  initial?: MediaAssetDescriptor;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<MediaAsset | null>(() => initial ? persistedAsset(initial) : null);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial ? persistedAsset(initial) : null));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== baseline;
  const usages = initial ? [
    ...referencesTo(snapshot, `media-${initial.kind}`, initial.id),
    ...(initial.kind === "audio" ? referencesTo(snapshot, "media-sound", initial.id) : []),
  ] : [];
  const hasProjectMetadata = Boolean(initial && snapshot.mediaAssets.some((asset) => asset.id === initial.id));
  const repositoryAvailable = initial?.contentSource === "repository";
  const missingContent = initial?.contentSource === "missing";
  const previewUrl = initial?.available ? configuredAssetContentStore.urlFor(initial) : "";
  const dimensions = draft ? mediaAssetDimensions(draft) : null;
  const dimensionText = dimensions
    ? dimensions.unit === "px"
      ? `${dimensions.width}×${dimensions.height} px`
      : `${dimensions.width}×${dimensions.height} viewBox units`
    : "";

  useEffect(() => {
    setWorkspaceDirty(dirty);
    return () => setWorkspaceDirty(false);
  }, [dirty, setWorkspaceDirty]);

  const save = async () => {
    if (!draft || !repositoryAvailable) return;
    setSaving(true);
    setError("");
    try {
      // Repository bytes stay in Git. This row stores only project-specific
      // presentation/name metadata against the same stable Media ID.
      const repositoryMetadata = configuredAssetContentStore.repositoryMetadata(draft.id);
      if (!repositoryMetadata) throw new Error("Repository Media metadata is unavailable.");
      const asset: MediaAsset = {
        ...draft,
        contentKey: null,
        ...repositoryMetadata,
      };
      const result = await onSave(
        [{ type: "mediaAsset.upsert", asset }],
        `Changed repository media metadata ${asset.name}`,
      );
      if (result.status === "saved" || result.status === "queued") {
        setDraft(asset);
        setBaseline(JSON.stringify(asset));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Media metadata save failed.");
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
      : `Delete missing media definition “${initial.name}”?`;
    if (!window.confirm(prompt)) return;
    setSaving(true);
    try {
      const result = await onSave(
        [{ type: "mediaAsset.delete", id: initial.id }],
        resetting ? `Reset media asset ${initial.name} to repository copy` : `Deleted missing media definition ${initial.name}`,
      );
      if (result.status === "saved" || result.status === "queued") onCancel();
    } finally { setSaving(false); }
  };

  const exportAsset = async () => {
    if (!draft || dirty || !repositoryAvailable) return;
    const resolved = configuredAssetStore.resolve(snapshot, draft.id);
    if (!resolved?.available) return;
    setError("");
    try { await configuredAssetContentStore.exportAsset(resolved); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Asset export failed."); }
  };

  const lifecycleLabel = repositoryAvailable ? "RESET REPOSITORY METADATA" : "DELETE BROKEN DEFINITION";
  const lifecycleDisabled = saving || (!repositoryAvailable && usages.length > 0);

  return <section className="author-panel author-panel-frame media-asset-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>{kind === "audio" ? "SOUND" : "IMAGE"} FILE · {draft?.name ?? "REPOSITORY"}</span></header>
    <div className="author-panel-body">
      <p className="field-help">File Media lives in <code>public/assets/</code> and is shipped with the repository. Author rules store only its stable Media ID. Synths and vector SVGs are created inside Author mode and stored in D1.</p>

      {!initial ? <div className="author-message">
        ADD FILE MEDIA IN THE REPOSITORY<br />
        Put the {kind === "audio" ? "audio" : "image"} file under <code>public/assets/</code> and add a neighboring <code>.asset.json</code> sidecar containing a stable <code>id</code>. The asset will appear here after the next build.
      </div> : null}

      {missingContent && initial ? <div className="asset-warning" role="alert">
        <strong>MISSING REPOSITORY FILE</strong>
        <span>This Media definition still exists, but its file content does not. It will not play or render.</span>
        <span>To repair existing rules without changing their references, add the intended file under <code>public/assets/</code> and give its <code>.asset.json</code> sidecar this exact ID:</span>
        <code>{initial.id}</code>
        {usages.length ? <small>{usages.length} authored use{usages.length === 1 ? "" : "s"} still reference this ID.</small> : null}
      </div> : null}

      {draft ? <>
        <label>STABLE MEDIA ID <code>{draft.id}</code></label>
        {repositoryAvailable ? <>
          <label>NAME <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          {kind === "image" ? <label>DEFAULT PLAYER PRESENTATION
            <select value={draft.defaultPresentation} onChange={(event) => setDraft({ ...draft, defaultPresentation: event.target.value === "inline" ? "inline" : "overlay" })}>
              <option value="inline">inline / icon</option>
              <option value="overlay">large art / overlay</option>
            </select>
            <small>This is independent of the file's pixel or SVG coordinate dimensions.</small>
          </label> : null}
          <div className="media-asset-preview">
            {previewUrl ? kind === "audio" ? <audio controls src={previewUrl} /> : <img src={previewUrl} alt="Asset preview" /> : <span>REPOSITORY FILE UNAVAILABLE.</span>}
          </div>
          <small>repository file · {draft.mimeType} · {draft.byteLength} bytes{dimensionText ? ` · ${dimensionText}` : ""}</small>
        </> : null}
      </> : null}
      {error ? <div className="author-message" role="alert">{error}</div> : null}
    </div>
    <div className="author-actions author-panel-footer">
      {repositoryAvailable ? <button type="button" disabled={!draft || !dirty || saving || !draft.name.trim()} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE METADATA"}]</button> : null}
      {repositoryAvailable && initial ? <button type="button" disabled={saving || dirty} title={dirty ? "Save changes before exporting." : undefined} onClick={() => void exportAsset()}>[EXPORT + ID]</button> : null}
      <button type="button" onClick={onCancel}>[CLOSE]</button>
      {initial && hasProjectMetadata ? <button
        type="button"
        className="danger"
        disabled={lifecycleDisabled}
        title={!repositoryAvailable && usages.length ? `Still used by ${usages.map((usage) => usage.ownerLabel).join(", ")}` : undefined}
        onClick={() => void resetOrDelete()}
      >[{lifecycleLabel}{!repositoryAvailable && usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}]</button> : null}
    </div>
  </section>;
}