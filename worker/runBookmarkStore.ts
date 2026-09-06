import type { AuthorBookmark } from "../src/engine/project/model";
import { parseJson } from "./db/json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function runBookmarkError(value: unknown) {
  if (!isRecord(value)) return "Run bookmark is invalid.";
  if (typeof value.id !== "string" || !value.id.trim()) return "Run bookmark id is invalid.";
  if (typeof value.nodeId !== "string" || !value.nodeId.trim()) return "Run bookmark node is invalid.";
  if (!Array.isArray(value.traversal) || !value.traversal.every((item) => typeof item === "string")) {
    return "Run bookmark traversal is invalid.";
  }
  if (!isRecord(value.playState)) return "Run bookmark play state is invalid.";
  if (typeof value.note !== "string" || value.note.length > 160) return "Run bookmark name is invalid.";
  if (typeof value.createdAt !== "string" || !value.createdAt) return "Run bookmark timestamp is invalid.";
  return null;
}

function upsertRunBookmarkStatement(db: D1Database, bookmark: AuthorBookmark) {
  return db.prepare(
    `INSERT INTO bookmarks (id, node_id, traversal_json, play_state_json, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET node_id=excluded.node_id, traversal_json=excluded.traversal_json,
       play_state_json=excluded.play_state_json, note=excluded.note`,
  ).bind(
    bookmark.id,
    bookmark.nodeId,
    JSON.stringify(bookmark.traversal),
    JSON.stringify(bookmark.playState),
    bookmark.note,
    bookmark.createdAt,
  );
}

async function getRunBookmarksRaw(db: D1Database): Promise<AuthorBookmark[]> {
  const result = await db.prepare(
    "SELECT id, node_id, traversal_json, play_state_json, note, created_at FROM bookmarks ORDER BY created_at DESC",
  ).all<{
    id: string;
    node_id: string;
    traversal_json: string;
    play_state_json: string;
    note: string;
    created_at: string;
  }>();
  return result.results.map((row) => ({
    id: row.id,
    nodeId: row.node_id,
    traversal: parseJson(row.traversal_json, []),
    playState: parseJson(row.play_state_json, {} as AuthorBookmark["playState"]),
    note: row.note,
    createdAt: row.created_at,
  }));
}

type LegacyRevisionPayload = {
  description?: string;
  beforeBookmarks?: unknown[];
};

/**
 * Earlier prototypes made run bookmarks part of project mutation/restore state.
 * Whole-project import or Undo could therefore erase them without a bookmark
 * delete revision. Recover named bookmarks that revision snapshots prove were
 * live and that were not explicitly deleted afterward. This is idempotent and
 * deliberately conservative for unnamed bookmarks, whose delete intent cannot
 * be reconstructed safely from old descriptions.
 */
async function repairLegacyRunBookmarkLosses(db: D1Database) {
  const current = await getRunBookmarksRaw(db);
  const liveIds = new Set(current.map((bookmark) => bookmark.id));
  const rows = await db.prepare(
    "SELECT revision, kind, payload FROM revisions WHERE payload LIKE '%beforeBookmarks%' ORDER BY revision ASC",
  ).all<{ revision: number; kind: string; payload: string }>();
  const candidates = new Map<string, { bookmark: AuthorBookmark; lastSeenRevision: number }>();
  const deletedAt = new Map<string, number>();

  for (const row of rows.results) {
    const payload = parseJson<LegacyRevisionPayload>(row.payload, {});
    const before = Array.isArray(payload.beforeBookmarks)
      ? payload.beforeBookmarks.filter((bookmark): bookmark is AuthorBookmark => !runBookmarkError(bookmark))
      : [];
    for (const bookmark of before) {
      candidates.set(bookmark.id, { bookmark, lastSeenRevision: row.revision });
    }
    if (row.kind !== "bookmark.delete") continue;
    const description = payload.description ?? "";
    for (const bookmark of before) {
      if (!bookmark.note.trim()) continue;
      if (
        description === `Deleted saved location: ${bookmark.note}`
        || description === `Deleted run bookmark: ${bookmark.note}`
      ) {
        deletedAt.set(bookmark.id, row.revision);
      }
    }
  }

  const recoverable = [...candidates.values()].filter(({ bookmark, lastSeenRevision }) =>
    !liveIds.has(bookmark.id)
    && Boolean(bookmark.note.trim())
    && (deletedAt.get(bookmark.id) ?? -1) < lastSeenRevision,
  );
  if (!recoverable.length) return 0;
  await db.batch(recoverable.map(({ bookmark }) => upsertRunBookmarkStatement(db, bookmark)));
  return recoverable.length;
}

export async function getRunBookmarks(db: D1Database): Promise<AuthorBookmark[]> {
  await repairLegacyRunBookmarkLosses(db);
  return getRunBookmarksRaw(db);
}

export async function saveRunBookmark(db: D1Database, bookmark: AuthorBookmark) {
  await upsertRunBookmarkStatement(db, bookmark).run();
  return bookmark;
}

export async function deleteRunBookmark(db: D1Database, id: string) {
  await db.prepare("DELETE FROM bookmarks WHERE id = ?").bind(id).run();
}
