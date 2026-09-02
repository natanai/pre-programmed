import { useEffect, useState } from "react";
import type { AuthorWorkspaceSaveHandler } from "../../../author/features/types";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import type { GameNode } from "../model";
import { AuthoredTextEditor, type AuthoredTextValue } from "./AuthoredTextEditor";
import "./nodeEditor.css";

type NodeScreen = "text" | "context";

export function NodeEditor({ node, snapshot, autoFocusText = false, onSave, onCancel, onDirtyChange, onRegisterSave, onPreview }: {
  node: GameNode;
  snapshot: ProjectSnapshot;
  autoFocusText?: boolean;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onRegisterSave?: (handler: AuthorWorkspaceSaveHandler | null) => void;
  onPreview?: (value: AuthoredTextValue, speakerId: string | null) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(node));
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify(node));
  const [screen, setScreen] = useState<NodeScreen>("text");
  const [saving, setSaving] = useState(false);
  const draftSignature = JSON.stringify(draft);

  useEffect(() => {
    onDirtyChange(draftSignature !== savedSignature);
    return () => onDirtyChange(false);
  }, [draftSignature, savedSignature, onDirtyChange]);

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const result = await onSave([{ type: "node.upsert", node: draft }], `Changed node #${draft.nodeNumber}`);
      if (result.status === "saved" || result.status === "queued") {
        setSavedSignature(draftSignature);
        return true;
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(save);
    return () => onRegisterSave(null);
  });

  const speaker = snapshot.entities.find((entity) => entity.id === draft.characterId)?.name ?? "None";
  const location = snapshot.entities.find((entity) => entity.id === draft.locationId)?.name ?? "None";
  const screenTitle = screen === "text" ? `NODE #${draft.nodeNumber}` : screen.toUpperCase();

  return <section className="author-panel author-panel-frame node-editor focused-node-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header className="focused-node-header">
      {screen !== "text" ? <button type="button" className="focused-node-back" onClick={() => setScreen("text")}>[‹]</button> : null}
      <span>{screenTitle}</span>
      {screen !== "text" ? <small>NODE #{draft.nodeNumber}</small> : null}
    </header>

    <div className="author-panel-body focused-node-body">
      {screen === "text" ? <>
        <AuthoredTextEditor
          value={{ text: draft.text, performance: draft.performance }}
          snapshot={snapshot}
          label="NODE TEXT"
          rows={7}
          autoFocus={autoFocusText}
          onChange={(value) => setDraft({ ...draft, text: value.text, performance: value.performance })}
          onPreview={onPreview ? (value) => onPreview(value, draft.characterId) : undefined}
        />

        <div className="node-summary-list">
          <button type="button" onClick={() => setScreen("context")}>
            <span><strong>CONTEXT</strong><small>{speaker} · {location}{draft.tags.length ? ` · ${draft.tags.length} tag${draft.tags.length === 1 ? "" : "s"}` : ""}</small></span><span aria-hidden="true">›</span>
          </button>
        </div>

        <label className="check-label node-ending-toggle"><input type="checkbox" checked={draft.ending} onChange={(event) => setDraft({ ...draft, ending: event.target.checked })} /> intentional ending [E]</label>
      </> : null}

      {screen === "context" ? <div className="node-focused-form">
        <h3>WHO / WHERE IS THIS TEXT?</h3>
        <label>CHARACTER / SPEAKER <ReferenceField kind="character" value={draft.characterId ?? ""} onChange={(characterId) => setDraft({ ...draft, characterId: characterId || null })} placeholder="none" /></label>
        <label>LOCATION <ReferenceField kind="location" value={draft.locationId ?? ""} onChange={(locationId) => setDraft({ ...draft, locationId: locationId || null })} placeholder="none" /></label>
        <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
      </div> : null}

    </div>

    <div className="author-actions author-panel-footer"><button type="button" disabled={saving} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button><button type="button" onClick={onCancel}>[CANCEL]</button></div>
  </section>;
}
