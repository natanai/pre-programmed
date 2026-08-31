import { useState } from "react";
import { GeneratedKeyField } from "../../../author/GeneratedKeyField";
import { resolveAuthorKey } from "../../../author/generatedKey";
import type { ItemDefinition, MutationOperation, ProjectSnapshot } from "../../../game/model";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";
import { OperationHooksEditor } from "../../../components/OperationHooksEditor";
import "./inventoryAuthor.css";

function emptyItem(): ItemDefinition {
  return {
    id: crypto.randomUUID(), key: "", name: "", description: "", assetPath: "", width: 1, height: 1,
    stackable: false, maxStack: 1, removable: true, startingQuantity: 1,
    interactable: true, operations: ["inspect", "use", "move", "remove"], tags: [], initialState: {}, hooks: [],
  };
}

export function ItemEditor({ snapshot, initial, onSave, onCancel }: {
  snapshot: ProjectSnapshot;
  initial?: ItemDefinition;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial ?? emptyItem()));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!draft.name.trim()) return;
    const item = {
      ...draft,
      key: resolveAuthorKey({
        override: draft.key,
        source: draft.name,
        existingKeys: snapshot.items.filter((candidate) => candidate.id !== draft.id).map((candidate) => candidate.key),
        fallback: "item",
      }),
    };
    setDraft(item);
    setSaving(true);
    try { await onSave([{ type: "item.upsert", item }], `${initial ? "Changed" : "Created"} item ${item.name}`); }
    finally { setSaving(false); }
  };

  return <section className="author-panel author-panel-frame item-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>ITEM · {draft.name || "NEW"}</span></header>
    <div className="author-panel-body item-editor-body">
      <section className="item-editor-section">
        <h3>IDENTITY</h3>
        <label>NAME <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus /></label>
        <label>DESCRIPTION <textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
        <GeneratedKeyField source={draft.name} value={draft.key} onChange={(key) => setDraft({ ...draft, key })} />
      </section>

      <section className="item-editor-section">
        <h3>INVENTORY TILE</h3>
        <label>ASSET <select value={draft.assetPath} onChange={(event) => setDraft({ ...draft, assetPath: event.target.value })}>
          <option value="">none / text tile</option>
          {ASSET_MANIFEST.filter((asset) => asset.type === "image" && asset.runtimePath).map((asset) => <option value={asset.runtimePath!} key={asset.path}>{asset.path.replace(/^public\/assets\//, "")}</option>)}
        </select></label>
        <div className="form-grid">
          <label>WIDTH <input type="number" min={1} max={10} value={draft.width} onChange={(event) => setDraft({ ...draft, width: Number(event.target.value) })} /></label>
          <label>HEIGHT <input type="number" min={1} max={6} value={draft.height} onChange={(event) => setDraft({ ...draft, height: Number(event.target.value) })} /></label>
          <label className="check-label"><input type="checkbox" checked={draft.stackable} onChange={(event) => setDraft({ ...draft, stackable: event.target.checked })} /> stackable</label>
          <label>MAX STACK <input type="number" min={1} value={draft.maxStack} onChange={(event) => setDraft({ ...draft, maxStack: Number(event.target.value) })} /></label>
          <label className="check-label"><input type="checkbox" checked={draft.removable} onChange={(event) => setDraft({ ...draft, removable: event.target.checked })} /> removal succeeds without a hook</label>
          <label>DEFAULT QUANTITY <input type="number" min={0} step={1} value={draft.startingQuantity ?? 0} onChange={(event) => setDraft({ ...draft, startingQuantity: Math.max(0, Math.floor(Number(event.target.value))) })} /><small>Placed in every new playthrough.</small></label>
        </div>
      </section>

      <section className="item-editor-section">
        <h3>PLAYER BEHAVIOR</h3>
        <OperationHooksEditor snapshot={snapshot} capability={{ interactable: draft.interactable ?? true, operations: draft.operations ?? ["inspect", "use", "move", "remove"], hooks: draft.hooks ?? [] }}
          onChange={(capability) => setDraft({ ...draft, ...capability })} />
      </section>
    </div>
    <div className="author-actions author-panel-footer"><button type="button" disabled={saving} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button><button type="button" onClick={onCancel}>[CANCEL]</button></div>
  </section>;
}
