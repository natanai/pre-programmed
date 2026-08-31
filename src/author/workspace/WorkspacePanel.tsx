import { useEffect, useState } from "react";
import { fetchAuthorWorkspace, undoLastRevision } from "../../data/api";
import type {
  AuthorBookmark,
  MutationOperation,
  PlayState,
  ProjectSnapshot,
  RevisionSummary,
} from "../../game/model";
import { advanceTimedVariables } from "../../game/timedVariables";

export function WorkspacePanel({ token, snapshot, playState, initialView = "locations", onSave, onSnapshot, onRestore }: {
  token: string;
  snapshot: ProjectSnapshot;
  playState: PlayState;
  initialView?: "locations" | "history";
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"locations" | "history">(initialView);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [bookmarks, setBookmarks] = useState<AuthorBookmark[]>([]);
  const [note, setNote] = useState("");
  const refresh = () => void fetchAuthorWorkspace(token).then((workspace) => { setRevisions(workspace.revisions); setBookmarks(workspace.bookmarks); });
  useEffect(refresh, [token, snapshot.revision]);

  const createBookmark = async () => {
    const savedAt = Date.now();
    const label = note.trim();
    const savedState = advanceTimedVariables(snapshot, playState, savedAt);
    const bookmark: AuthorBookmark = {
      id: crypto.randomUUID(), nodeId: savedState.currentNodeId, traversal: savedState.traversal,
      playState: savedState, note: label, createdAt: new Date(savedAt).toISOString(),
    };
    await onSave([{ type: "bookmark.upsert", bookmark }], `Saved location${label ? `: ${label}` : ""}`);
    setNote("");
  };

  return <section className="author-panel author-panel-frame workspace-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>{view === "locations" ? "SAVED LOCATIONS" : "HISTORY"}</span></header>
    <div className="author-panel-body">
      <nav className="panel-tabs"><button type="button" aria-pressed={view === "locations"} onClick={() => setView("locations")}>[LOCATIONS]</button><button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>[HISTORY]</button></nav>
      {view === "locations" ? <>
        <div className="bookmark-create"><input aria-label="Saved location name" placeholder="optional location name" value={note} onChange={(event) => setNote(event.target.value)} /><button type="button" onClick={() => void createBookmark()}>[SAVE HERE]</button></div>
        <div className="workspace-list">{bookmarks.map((bookmark) => {
          const node = snapshot.nodes.find((candidate) => candidate.id === bookmark.nodeId);
          return <div key={bookmark.id}><span>#{node?.nodeNumber} {bookmark.note || node?.text.slice(0, 60) || "saved location"}</span><button type="button" onClick={() => onRestore(bookmark)}>[LOAD]</button></div>;
        })}{!bookmarks.length ? <span className="workspace-empty">NO SAVED LOCATIONS.</span> : null}</div>
      </> : <>
        <div className="workspace-list revisions">{revisions.map((revision) => <div key={revision.revision}><span>R{revision.revision} {revision.description}</span><small>{new Date(revision.createdAt).toLocaleString()}</small></div>)}</div>
        <button type="button" onClick={() => void undoLastRevision(token, snapshot.revision).then((result) => onSnapshot(result.snapshot))}>[UNDO LAST CHANGE]</button>
      </>}
    </div>
  </section>;
}
