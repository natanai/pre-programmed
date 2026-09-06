import { useEffect, useState } from "react";
import {
  deleteAuthorRunBookmark,
  fetchAuthorWorkspace,
  saveAuthorRunBookmark,
  undoLastRevision,
} from "../../data/api";
import { advanceProjectClocks } from "../../engine/runtime/projectClock";
import type {
  AuthorBookmark,
  PlayState,
  ProjectSnapshot,
  RevisionSummary,
} from "../../engine/project/model";
import "./workspacePanel.css";
import "./workspacePanelRunNavigation.css";

type WorkspaceView = "navigation" | "history";

export function WorkspacePanel({ token, snapshot, playState, initialView = "navigation", onSnapshot, onRestore, onEditNode }: {
  token: string;
  snapshot: ProjectSnapshot;
  playState: PlayState;
  initialView?: WorkspaceView;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
  onEditNode: (nodeId: string) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [bookmarks, setBookmarks] = useState<AuthorBookmark[]>([]);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [deletingBookmarkId, setDeletingBookmarkId] = useState("");
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setWorkspaceError("");
    try {
      const workspace = await fetchAuthorWorkspace(token);
      setRevisions(workspace.revisions);
      setBookmarks(workspace.bookmarks);
    } catch {
      setWorkspaceError("AUTHOR WORKSPACE DATA COULD NOT BE LOADED.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [token, snapshot.revision]);

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

  const switchView = (next: WorkspaceView) => {
    setView(next);
    setQuery("");
    setConfirmUndo(false);
    setActionMessage("");
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
    setActionMessage("");
    try {
      const savedAt = Date.now();
      const label = note.trim();
      const savedState = advanceProjectClocks(snapshot, playState, savedAt);
      const bookmark: AuthorBookmark = {
        id: crypto.randomUUID(), nodeId: savedState.currentNodeId, traversal: savedState.traversal,
        playState: savedState, note: label, createdAt: new Date(savedAt).toISOString(),
      };
      const saved = await saveAuthorRunBookmark(token, bookmark);
      setBookmarks((current) => [saved, ...current.filter((candidate) => candidate.id !== saved.id)]);
      setNote("");
      setActionMessage("RUN BOOKMARK SAVED.");
    } catch {
      setActionMessage("RUN BOOKMARK COULD NOT BE SAVED.");
    } finally {
      setSavingBookmark(false);
    }
  };

  const deleteBookmark = async (bookmark: AuthorBookmark) => {
    if (deletingBookmarkId) return;
    setDeletingBookmarkId(bookmark.id);
    setActionMessage("");
    try {
      await deleteAuthorRunBookmark(token, bookmark.id);
      setBookmarks((current) => current.filter((candidate) => candidate.id !== bookmark.id));
      setActionMessage("RUN BOOKMARK DELETED.");
    } catch {
      setActionMessage("RUN BOOKMARK COULD NOT BE DELETED.");
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

  const resultCount = view === "navigation" ? filteredBookmarks.length : filteredRevisions.length;
  const totalCount = view === "navigation" ? bookmarks.length : revisions.length;

  return <section className="author-panel author-panel-frame workspace-panel native-workspace-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>{view === "navigation" ? "RUN NAVIGATION" : "HISTORY"}</span></header>
    <div className="author-panel-body workspace-native-body">
      <nav className="panel-tabs workspace-tabs" aria-label="Run navigation and project history">
        <button type="button" aria-pressed={view === "navigation"} onClick={() => switchView("navigation")}>RUN NAVIGATION</button>
        <button type="button" aria-pressed={view === "history"} onClick={() => switchView("history")}>HISTORY</button>
      </nav>

      <div className="workspace-search-row">
        <label htmlFor="workspace-search">FIND</label>
        <div className="workspace-search-control">
          <input
            id="workspace-search"
            type="search"
            value={query}
            placeholder={view === "navigation" ? "bookmark name, node, or scene text" : "revision or change description"}
            onChange={(event) => setQuery(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <span aria-live="polite">{normalizedQuery ? `${resultCount}/${totalCount}` : totalCount}</span>
          {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>[X]</button> : null}
        </div>
      </div>

      {workspaceError ? <div className="workspace-load-status" role="alert">
        <span>{workspaceError}</span>
        <button type="button" onClick={() => void refresh()}>[RETRY]</button>
      </div> : null}
      {!workspaceError && loading && !totalCount ? <div className="workspace-load-status" role="status">LOADING...</div> : null}
      {actionMessage ? <div className="workspace-action-status" role="status">{actionMessage}</div> : null}

      {view === "navigation" ? <div className="workspace-view workspace-run-navigation-view">
        <div className="workspace-run-tools">
          <div className="workspace-current-node">
            <small>CURRENT NODE</small>
            <strong>#{currentNode?.nodeNumber ?? "?"}</strong>
            <span>{currentNode?.text.slice(0, 110) || "Current scene"}</span>
            {currentNode ? <button type="button" onClick={() => onEditNode(currentNode.id)}>[EDIT NODE]</button> : null}
          </div>
          <div className="workspace-node-navigation">
            <div className="workspace-node-navigation-actions">
              <button type="button" disabled={!previousNode} onClick={navigateBack}>
                [{previousNode ? `← BACK TO #${previousNode.nodeNumber}` : "← NO PREVIOUS NODE"}]
              </button>
              {previousNode ? <button type="button" onClick={() => onEditNode(previousNode.id)}>[EDIT #{previousNode.nodeNumber}]</button> : null}
            </div>
            {previousNode ? <small>{previousNode.text.slice(0, 100) || "Previous scene"}</small> : <small>This run is already at the beginning of its traversal.</small>}
          </div>
        </div>

        <section className="workspace-run-bookmarks" aria-label="Run bookmarks">
          <div className="workspace-subsection-heading">
            <strong>RUN BOOKMARKS</strong>
            <small>{bookmarks.length}</small>
          </div>
          <div className="workspace-native-list" aria-label="Run bookmarks">
            {filteredBookmarks.map((bookmark) => {
              const node = snapshot.nodes.find((candidate) => candidate.id === bookmark.nodeId);
              const deleting = deletingBookmarkId === bookmark.id;
              return <article className="workspace-native-row workspace-bookmark-row" key={bookmark.id}>
                <span className="workspace-row-copy">
                  <strong>{bookmark.note || `Node #${node?.nodeNumber ?? "?"}`}</strong>
                  <small>{node ? `#${node.nodeNumber} · ${node.text.slice(0, 90) || "Saved run state"}` : "SAVED NODE IS NOT PRESENT IN THIS PROJECT."}</small>
                  <small>{new Date(bookmark.createdAt).toLocaleString()}</small>
                </span>
                <span className="workspace-row-actions">
                  <button type="button" disabled={Boolean(deletingBookmarkId) || !node} onClick={() => onRestore(bookmark)}>[{node ? "LOAD" : "UNAVAILABLE"}]</button>
                  {node ? <button type="button" disabled={Boolean(deletingBookmarkId)} onClick={() => onEditNode(node.id)}>[EDIT NODE]</button> : null}
                  <button type="button" disabled={Boolean(deletingBookmarkId)} onClick={() => void deleteBookmark(bookmark)}>[{deleting ? "DELETING..." : "DELETE"}]</button>
                </span>
              </article>;
            })}
            {!loading && !workspaceError && !filteredBookmarks.length ? <span className="workspace-empty workspace-native-empty">{normalizedQuery ? "NO MATCHING RUN BOOKMARKS." : "NO RUN BOOKMARKS."}</span> : null}
          </div>
          <div className="bookmark-create workspace-bookmark-create">
            <input aria-label="Run bookmark name" placeholder="optional bookmark name" value={note} onChange={(event) => setNote(event.target.value)} />
            <button type="button" disabled={savingBookmark} onClick={() => void createBookmark()}>[{savingBookmark ? "SAVING..." : "SAVE BOOKMARK"}]</button>
          </div>
        </section>
      </div> : <div className="workspace-view workspace-history-view">
        <div className="workspace-native-list revisions" aria-label="Project revision history">
          {filteredRevisions.map((revision) => <article className="workspace-native-row workspace-revision-row" key={revision.revision}>
            <span className="workspace-row-copy">
              <strong>R{revision.revision} · {revision.description}</strong>
              <small>{new Date(revision.createdAt).toLocaleString()}</small>
            </span>
          </article>)}
          {!loading && !workspaceError && !filteredRevisions.length ? <span className="workspace-empty workspace-native-empty">{normalizedQuery ? "NO MATCHING HISTORY." : "NO REVISION HISTORY."}</span> : null}
        </div>
      </div>}
    </div>

    {view === "history" ? <div className="author-panel-footer workspace-history-footer">
      {!confirmUndo ? <button type="button" disabled={!latestRevision || undoing} onClick={() => setConfirmUndo(true)}>[UNDO LAST PROJECT CHANGE]</button> : <div className="workspace-undo-confirm" role="group" aria-label="Confirm undo last project change">
        <span>{latestRevision ? `UNDO R${latestRevision.revision}: ${latestRevision.description}?` : "NOTHING TO UNDO."}</span>
        <button type="button" disabled={undoing || !latestRevision} onClick={() => void undoLatest()}>[{undoing ? "UNDOING..." : "UNDO"}]</button>
        <button type="button" disabled={undoing} onClick={() => setConfirmUndo(false)}>[KEEP]</button>
      </div>}
    </div> : null}
  </section>;
}
