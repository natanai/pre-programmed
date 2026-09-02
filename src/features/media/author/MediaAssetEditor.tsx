import { useEffect, useState } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import { referencesTo } from "../../../author/references/projectReferences";
import type { MediaAsset, MediaAssetKind } from "../model";
import { configuredAssetStore } from "../ui/assetStore";
import "./mediaAuthor.css";

const MAX_ASSET_BYTES = 1_000_000;

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function imageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

export function MediaAssetEditor({ snapshot, kind, initial, onSave, onCancel, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  kind: MediaAssetKind;
  initial?: MediaAsset;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<MediaAsset | null>(() => initial ? structuredClone(initial) : null);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial ?? null));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== baseline;
  const usages = initial ? referencesTo(snapshot, `media-${initial.kind}`, initial.id) : [];

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
      setError("This portable asset store currently accepts files up to 1 MB.");
      return;
    }
    const dataUrl = await readFile(file);
    const dimensions = kind === "image" ? await imageDimensions(dataUrl) : null;
    const created = configuredAssetStore.createEmbedded({
      name: file.name,
      mimeType: file.type || (kind === "image" ? "image/png" : "audio/mpeg"),
      dataUrl,
      size: file.size,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    });
    setDraft(initial ? { ...created, id: initial.id } : created);
    setError("");
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await onSave(
        [{ type: "mediaAsset.upsert", asset: draft }],
        `${initial ? "Changed" : "Added"} media asset ${draft.name}`,
      );
      if (result.status === "saved" || result.status === "queued") setBaseline(JSON.stringify(draft));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial || usages.length || !window.confirm(`Delete media asset “${initial.name}”?`)) return;
    setSaving(true);
    try {
      const result = await onSave([{ type: "mediaAsset.delete", id: initial.id }], `Deleted media asset ${initial.name}`);
      if (result.status === "saved" || result.status === "queued") onCancel();
    } finally { setSaving(false); }
  };

  return <section className="author-panel author-panel-frame media-asset-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>{kind === "audio" ? "SOUND" : "IMAGE"} ASSET · {draft?.name ?? "NEW"}</span></header>
    <div className="author-panel-body">
      <p className="field-help">Choose a file while you author. It is saved with the project under a stable reference, so responses and effects do not depend on a browser-local path.</p>
      <label>FILE <input type="file" accept={kind === "audio" ? "audio/*" : "image/*"} onChange={(event) => void chooseFile(event.target.files?.[0])} /></label>
      <small>Portable embedded assets are currently limited to 1 MB each.</small>
      {draft ? <>
        <label>NAME <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <div className="media-asset-preview">
          {kind === "audio" ? <audio controls src={draft.dataUrl} /> : <img src={draft.dataUrl} alt="Asset preview" />}
        </div>
        <small>{draft.mimeType} · {draft.size} bytes{draft.width && draft.height ? ` · ${draft.width}×${draft.height}` : ""}</small>
      </> : null}
      {error ? <div className="author-message" role="alert">{error}</div> : null}
    </div>
    <div className="author-actions author-panel-footer">
      <button type="button" disabled={!draft || !dirty || saving || !draft.name.trim()} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE ASSET"}]</button>
      <button type="button" onClick={onCancel}>[CANCEL]</button>
      {initial ? <button type="button" className="danger" disabled={saving || usages.length > 0} title={usages.length ? `Used by ${usages.map((usage) => usage.ownerLabel).join(", ")}` : undefined} onClick={() => void remove()}>[DELETE{usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}]</button> : null}
    </div>
  </section>;
}
