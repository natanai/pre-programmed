import { useEffect, useState } from "react";
import { fetchAuthorWorkspace, undoLastRevision } from "../../data/api";
import { advanceProjectClocks } from "../../engine/runtime/projectClock";
import type {
  AuthorBookmark,
  MutationOperation,
  PlayState,
  ProjectSnapshot,
  RevisionSummary,
} from "../../engine/project/model";
import "./workspacePanel.css";
import "./workspacePanelLocations.css";

export function WorkspacePanel({ token, snapshot, playState, initialView = "locations", onSave, onSnapshot, onRestore, onEditNode }: {
  token: string;
  snapshot: ProjectSnapshot;
  playState: PlayState;
  initialView?: "locations" | "history";
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
  onEditNode: (nodeId: string) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"locations" | "history">(initialView);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [bookmarks, setBookmarks] = useState<AuthorBookmark[]>([]);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [deletingBookmarkId, setDeletingBookmarkId] = useState("");
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const refresh = () => void fetchAuthorWorkspace(token).then((workspace) => {
    setRevisions(workspace.revisions);
    setBookmarks(workspace.bookmarks);
  });
  useEffect(refresh, [token, snapshot.revision]);

  const currentNode = snapshot.nodes.find((node) => node.id === playState.currentNodeId);
  const previousNodeId = playState.traversal.length > 1 ? playState.traversal.at(-2) : undefined;
  const previousNode = previousNodeId
    ? snapshot.nodes.find((node) => node.id === previousNodeId)
    : undefined;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredBookmarks = bookmarks.filter((bookmark) => {
    if (!normalizedQuery) return true;
    const node = snapshot.nodes.find((candidate) => candidate.id === bookmark.nodeId);
    return `${bookmark.note} ${node?.nodeNumber ?? ""} ${node?.text ?? ""}`.toLowerCase().includes(normalizedQuery);
  });
  const filteredRevisions = revisions.filter((revision) => {
    if (!normalizedQuery) return true;
    return `r${revision.revision} ${revision.description} ${new Date(revision.createdAt).toLocaleString()}`.toLowerCase().includes(normalizedQuery);
  });
  const latestRevision = revisions.reduce<RevisionSummary | undefined>(
    (latest, revision) => !latest || revision.revision > latest.revision ? revision : latest,
    undefined,
  );

  const switchView = (next: "locations" | "history") => {
    setView(next);
    setQuery("");
    setConfirmUndo(false);
  };

  const navigateBack = () => {
    if (!previousNodeId || !previousNode) return;
    const traversal = playState.traversal.slice(0, -1);
    const navigationState: PlayState = {
      ...structuredClone(playState),
      currentNodeId: previousNodeId,
      traversal,
    };
    onRestore({
      id: `author-navigation:${crypto.randomUUID()}`,
      nodeId: previousNodeId,
      traversal,
      playState: navigationState,
      note: "",
      createdAt: new Date().toISOString(),
    });
  };

  const createBookmark = async () => {
    if (savingBookmark) return;
    setSavingBookmark(true);
    try {
      const savedAt = Date.now();
      const label = note.trim();
      const savedState = advanceProjectClocks(snapshot, playState, savedAt);
      const bookmark: AuthorBookmark = {
        id: crypto.randomUUID(), nodeId: savedState.currentNodeId, traversal: savedState.traversal,
        playState: savedState, note: label, createdAt: new Date(savedAt).toISOString(),
      };
      await onSave([{ type: "bookmark.upsert", bookmark }], `Saved location${label ? `: ${label}` : ""}`);
      setNote("");
    } finally {
      setSavingBookmark(false);
    }
  };

  const deleteBookmark = async (bookmark: AuthorBookmark) => {
    if (deletingBookmarkId) return;
    setDeletingBookmarkId(bookmark.id);
    try {
      await onSave(
        [{ type: "bookmark.delete", id: bookmark.id }],
        `Deleted saved location${bookmark.note ? `: ${bookmark.note}` : ""}`,
      );
    } finally {
      setDeletingBookmarkId("");
    }
  };

  const undoLatest = async () => {
    if (undoing || !latestRevision) return;
    setUndoing(true);
    try {
      const result = await undoLastRevision(token, snapshot.revision);
      onSnapshot(result.snapshot);
      setConfirmUndo(false);
    } finally {
      setUndoing(false);
    }
  };

  const resultCount = view === "locations" ? filteredBookmarks.length : filteredRevisions.length;
  const totalCount = view === "locations" ? bookmarks.length : revisions.length;

  return <section className="author-panel author-panel-frame workspace-panel native-workspace-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>{view === "locations" ? "LOCATIONS" : "HISTORY"}</span></header>
    <div className="author-panel-body workspace-native-body">
      <nav className="panel-tabs workspace-tabs" aria-label="Locations and history">
        <button type="button" aria-pressed={view === "locations"} onClick={() => switchView("locations")}>LOCATIONS</button>
        <button type="button" aria-pressed={view === "history"} onClick={() => switchView("history")}>HISTORY</button>
      </nav>

      <div className="workspace-search-row">
        <label htmlFor="workspace-search">FIND</label>
        <div className="workspace-search-control">
          <input
            id="workspace-search"
            type="search"
            value={query}
            placeholder={view === "locations" ? "saved name, node, or scene text" : "revision or change description"}
            onChange={(event) => setQuery(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <span aria-live="polite">{normalizedQuery ? `${resultCount}/${totalCount}` : totalCount}</span>
          {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>[X]</button> : null}
        </div>
      </div>

      {view === "locations" ? <div className="workspace-view workspace-locations-view">
        <div className="workspace-location-tools">
          <div className="workspace-current-location">
            <small>CURRENT LOCATION</small>
            <strong>#{currentNode?.nodeNumber ?? "?"}</strong>
            <span>{currentNode?.text.slice(0, 110) || "Current scene"}</span>
            {currentNode ? <button type="button" onClick={() => onEditNode(currentNode.id)}>[EDIT NODE]</button> : null}
          </div>
          <div className="workspace-location-navigation">
            <div className="workspace-location-navigation-actions">
              <button type="button" disabled={!previousNode} onClick={navigateBack}>
                [{previousNode ? `← BACK TO #${previousNode.nodeNumber}` : "← NO PREVIOUS NODE"}]
              </button>
              {previousNode ? <button type="button" onClick={() => onEditNode(previousNode.id)}>[EDIT #{previousNode.nodeNumber}]</button> : null}
            </div>
            {previousNode ? <small>{previousNode.text.slice(0, 100) || "Previous scene"}</small> : <small>This run is already at the beginning of its traversal.</small>}
          </div>
        </div>

        <section className="workspace-saved-locations" aria-label="Saved locations">
          <div className="workspace-subsection-heading">
            <strong>SAVED LOCATIONS</strong>
            <small>{bookmarks.length}</small>
          </div>
          <div className="bookmark-create workspace-bookmark-create">
            <input aria-label="Saved location name" placeholder="optional name" value={note} onChange={(event) => setNote(event.target.value)} />
            <button type="button" disabled={savingBookmark} onClick={() => void createBookmark()}>[{savingBookmark ? "SAVING..." : "SAVE HERE"}]</button>
          </div>

          <div className="workspace-native-list" aria-label="Saved locations">
            {filteredBookmarks.map((bookmark) => {
              const node = snapshot.nodes.find((candidate) => candidate.id === bookmark.nodeId);
              const deleting = deletingBookmarkId === bookmark.id;
              return <article className="workspace-native-row workspace-location-row" key={bookmark.id}>
                <span className="workspace-row-copy">
                  <strong>{bookmark.note || `Node #${node?.nodeNumber ?? "?"}`}</strong>
                  <small>#{node?.nodeNumber ?? "?"} · {node?.text.slice(0, 90) || "Saved location"}</small>
                  <small>{new Date(bookmark.createdAt).toLocaleString()}</small>
                </span>
                <span className="workspace-row-actions">
                  <button type="button" disabled={Boolean(deletingBookmarkId)} onClick={() => onRestore(bookmark)}>[LOAD]</button>
                  {node ? <button type="button" disabled={Boolean(deletingBookmarkId)} onClick={() => onEditNode(node.id)}>[EDIT NODE]</button> : null}
                  <button type="button" disabled={Boolean(deletingBookmarkId)} onClick={() => void deleteBookmark(bookmark)}>[{deleting ? "DELETING..." : "DELETE"}]</button>
                </span>
              </article>;
            })}
            {!filteredBookmarks.length ? <span className="workspace-empty workspace-native-empty">{normalizedQuery ? "NO MATCHING SAVED LOCATIONS." : "NO SAVED LOCATIONS."}</span> : null}
          </div>
        </section>
      </div> : <div className="workspace-view workspace-history-view">
        <div className="workspace-native-list revisions" aria-label="Revision history">
          {filteredRevisions.map((revision) => <article className="workspace-native-row workspace-revision-row" key={revision.revision}>
            <span className="workspace-row-copy">
              <strong>R{revision.revision} · {revision.description}</strong>
              <small>{new Date(revision.createdAt).toLocaleString()}</small>
            </span>
          </article>)}
          {!filteredRevisions.length ? <span className="workspace-empty workspace-native-empty">{normalizedQuery ? "NO MATCHING HISTORY." : "NO REVISION HISTORY."}</span> : null}
        </div>
      </div>}
    </div>

    {view === "history" ? <div className="author-panel-footer workspace-history-footer">
      {!confirmUndo ? <button type="button" disabled={!latestRevision || undoing} onClick={() => setConfirmUndo(true)}>[UNDO LAST CHANGE]</button> : <div className="workspace-undo-confirm" role="group" aria-label="Confirm undo last change">
        <span>{latestRevision ? `UNDO R${latestRevision.revision}: ${latestRevision.description}?` : "NOTHING TO UNDO."}</span>
        <button type="button" disabled={undoing || !latestRevision} onClick={() => void undoLatest()}>[{undoing ? "UNDOING..." : "UNDO"}]</button>
        <button type="button" disabled={undoing} onClick={() => setConfirmUndo(false)}>[KEEP]</button>
      </div>}
    </div> : null}
  </section>;
}
