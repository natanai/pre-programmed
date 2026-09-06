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

export async function getRunBookmarks(db: D1Database): Promise<AuthorBookmark[]> {
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

export async function saveRunBookmark(db: D1Database, bookmark: AuthorBookmark) {
  await upsertRunBookmarkStatement(db, bookmark).run();
  return bookmark;
}

export async function deleteRunBookmark(db: D1Database, id: string) {
  await db.prepare("DELETE FROM bookmarks WHERE id = ?").bind(id).run();
}
