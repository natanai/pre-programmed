import { useEffect, useMemo, useState } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";
import type { BodyBackgroundDefinition, MutationOperation, ProjectSnapshot } from "../../../game/model";
import { assetUrl } from "../../../data/assets";
import "./inventoryAuthor.css";

function emptyBackground(): BodyBackgroundDefinition {
  return { id: crypto.randomUUID(), name: "", assetPath: "" };
}

export function BodyBackgroundEditor({ snapshot, initial, onSave, onCancel, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  initial?: BodyBackgroundDefinition;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial ?? emptyBackground()));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [baseline, draft]);

  useEffect(() => {
    setWorkspaceDirty(dirty);
    return () => setWorkspaceDirty(false);
  }, [dirty, setWorkspaceDirty]);

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const background = { ...draft, name };
    const operations: MutationOperation[] = [{ type: "bodyBackground.upsert", background }];
    if (!initial && !snapshot.startingBodyBackgroundId && (snapshot.bodyBackgrounds ?? []).length === 0) {
      operations.push({ type: "bodyBackground.starting", id: background.id });
    }
    setDraft(background);
    setSaving(true);
    try {
      const result = await onSave(
        operations,
        `${initial ? "Changed" : "Created"} body background ${background.name}`,
      );
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify(background));
        setWorkspaceDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial || !window.confirm(`Delete body background “${initial.name}”?`)) return;
    setSaving(true);
    try {
      const result = await onSave(
        [{ type: "bodyBackground.delete", id: initial.id }],
        `Deleted body background ${initial.name}`,
      );
      if (result.status === "saved" || result.status === "queued") onCancel();
    } finally {
      setSaving(false);
    }
  };

  return <section className="author-panel author-panel-frame body-background-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>BODY BACKGROUND · {draft.name || "NEW"}</span></header>
    <div className="author-panel-body item-editor-body">
      <section className="item-editor-section">
        <h3>IDENTITY</h3>
        <label>NAME <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus /></label>
      </section>

      <section className="item-editor-section">
        <h3>BODY IMAGE</h3>
        <label>ASSET <select value={draft.assetPath} onChange={(event) => setDraft({ ...draft, assetPath: event.target.value })}>
          <option value="">none</option>
          {ASSET_MANIFEST.filter((asset) => asset.type === "image" && asset.runtimePath).map((asset) => <option value={asset.runtimePath!} key={asset.path}>{asset.path.replace(/^public\/assets\//, "")}</option>)}
        </select></label>
        <div className="body-background-preview" aria-label="Body background preview">
          {draft.assetPath ? <img src={assetUrl(draft.assetPath)} alt="" /> : <span>NO IMAGE SELECTED</span>}
        </div>
        <small>This image fills the body/equipment area. Triggers can switch the active background during play.</small>
      </section>
    </div>
    <div className="author-actions author-panel-footer">
      <button type="button" disabled={saving || !dirty || !draft.name.trim()} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>
      <button type="button" onClick={onCancel}>[CANCEL]</button>
      {initial ? <button type="button" className="danger" disabled={saving} onClick={() => void remove()}>[DELETE]</button> : null}
    </div>
  </section>;
}
