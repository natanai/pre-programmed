import type {
  AuthorBookmark,
  MutationOperation,
  ProjectMutation,
  ProjectSnapshot,
  RevisionSummary,
} from "../src/game/model";
import { parseJson } from "./db/json";
import { ensureSchema } from "./db/schema";
import {
  WORKER_FEATURE_PERSISTENCE,
  workerFeaturesForReset,
  workerFeaturesForRestore,
} from "./features/catalog";
import { json } from "./http";
import { loadProjectSettings, projectSettingsStatements } from "./projectSettingsStore";

export async function currentRevision(db: D1Database) {
  const row = await db.prepare("SELECT COALESCE(MAX(revision), 0) AS revision FROM revisions")
    .first<{ revision: number }>();
  return row?.revision ?? 0;
}

export async function getProjectSnapshot(db: D1Database): Promise<ProjectSnapshot> {
  await ensureSchema(db);
  const [meta, settings, featureSlices, revision] = await Promise.all([
    db.prepare("SELECT schema_version FROM project_meta WHERE id = 1")
      .first<{ schema_version: number }>(),
    loadProjectSettings(db),
    Promise.all(WORKER_FEATURE_PERSISTENCE.map((feature) => feature.load(db))),
    currentRevision(db),
  ]);

  if (!meta) throw new Error("Project has not been initialized.");
  const contributedProject = Object.assign({}, ...featureSlices) as Partial<ProjectSnapshot>;

  return {
    schemaVersion: Math.max(12, meta.schema_version),
    revision,
    settings,
    ...contributedProject,
  } as ProjectSnapshot;
}

export async function getBookmarks(db: D1Database): Promise<AuthorBookmark[]> {
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

function operationStatements(db: D1Database, operation: MutationOperation): D1PreparedStatement[] {
  for (const feature of WORKER_FEATURE_PERSISTENCE) {
    const statements = feature.mutationStatements(db, operation);
    if (statements) return statements;
  }

  switch (operation.type) {
    case "project.settings":
      return projectSettingsStatements(db, operation.settings);
    case "bookmark.upsert": {
      const bookmark = operation.bookmark;
      return [db.prepare(
        `INSERT INTO bookmarks (id, node_id, traversal_json, play_state_json, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET node_id=excluded.node_id, traversal_json=excluded.traversal_json,
           play_state_json=excluded.play_state_json, note=excluded.note`,
      ).bind(bookmark.id, bookmark.nodeId, JSON.stringify(bookmark.traversal), JSON.stringify(bookmark.playState), bookmark.note, bookmark.createdAt)];
    }
    case "bookmark.delete":
      return [db.prepare("DELETE FROM bookmarks WHERE id = ?").bind(operation.id)];
    default:
      return [];
  }
}

export async function applyMutation(db: D1Database, mutation: ProjectMutation) {
  const before = await getProjectSnapshot(db);
  if (mutation.expectedRevision !== before.revision) {
    return json(
      { error: "Project changed on another device. Synchronize before saving.", currentRevision: before.revision },
      { status: 409 },
    );
  }
  const beforeBookmarks = await getBookmarks(db);
  const statements = mutation.operations.flatMap((operation) => operationStatements(db, operation));
  statements.push(
    db.prepare("INSERT INTO revisions (kind, entity_id, payload) VALUES (?, ?, ?)").bind(
      mutation.operations.length === 1 ? mutation.operations[0].type : "mutation.batch",
      "project",
      JSON.stringify({ description: mutation.description, beforeSnapshot: before, beforeBookmarks }),
    ),
  );
  await db.batch(statements);
  return json({ snapshot: await getProjectSnapshot(db) });
}

function restoreStatements(db: D1Database, snapshot: ProjectSnapshot, bookmarks: AuthorBookmark[]): D1PreparedStatement[] {
  const coreDeletes = [db.prepare("DELETE FROM bookmarks")];
  const featureDeletes = workerFeaturesForReset().flatMap((feature) => feature.resetStatements(db));
  const operations: MutationOperation[] = [
    { type: "project.settings", settings: snapshot.settings },
    ...bookmarks.map((bookmark) => ({ type: "bookmark.upsert" as const, bookmark })),
    ...workerFeaturesForRestore().flatMap((feature) => feature.restoreOperations(snapshot)),
  ];
  return [...coreDeletes, ...featureDeletes, ...operations.flatMap((operation) => operationStatements(db, operation))];
}

export async function undo(db: D1Database, expectedRevision: number) {
  const revision = await currentRevision(db);
  if (revision !== expectedRevision) {
    return json({ error: "Project changed on another device.", currentRevision: revision }, { status: 409 });
  }
  const target = await db.prepare(
    `SELECT r.revision, r.payload
       FROM revisions r LEFT JOIN revision_undo u ON u.revision = r.revision
      WHERE r.kind <> 'undo' AND u.revision IS NULL
      ORDER BY r.revision DESC LIMIT 1`,
  ).first<{ revision: number; payload: string }>();
  if (!target) return json({ error: "Nothing to undo." }, { status: 404 });
  const payload = parseJson<{
    description?: string;
    beforeSnapshot?: ProjectSnapshot;
    beforeBookmarks?: AuthorBookmark[];
  }>(target.payload, {});
  if (!payload.beforeSnapshot) return json({ error: "This revision cannot be undone." }, { status: 409 });
  const current = await getProjectSnapshot(db);
  const statements = restoreStatements(db, payload.beforeSnapshot, payload.beforeBookmarks ?? []);
  statements.push(
    db.prepare("INSERT INTO revisions (kind, entity_id, payload) VALUES ('undo', ?, ?)")
      .bind(String(target.revision), JSON.stringify({ description: `Undo ${payload.description ?? target.revision}`, beforeSnapshot: current })),
  );
  await db.batch(statements);
  const undoRevision = await currentRevision(db);
  await db.prepare("INSERT INTO revision_undo (revision, undone_by_revision) VALUES (?, ?)")
    .bind(target.revision, undoRevision)
    .run();
  return json({ snapshot: await getProjectSnapshot(db) });
}

export async function getWorkspace(db: D1Database) {
  const [rows, bookmarks] = await Promise.all([
    db.prepare("SELECT revision, kind, entity_id, payload, created_at FROM revisions ORDER BY revision DESC LIMIT 50")
      .all<{ revision: number; kind: string; entity_id: string; payload: string; created_at: string }>(),
    getBookmarks(db),
  ]);
  const revisions: RevisionSummary[] = rows.results.map((row) => ({
    revision: row.revision,
    kind: row.kind,
    entityId: row.entity_id,
    description: parseJson<{ description?: string }>(row.payload, {}).description ?? row.kind,
    createdAt: row.created_at,
  }));
  return { revisions, bookmarks };
}
