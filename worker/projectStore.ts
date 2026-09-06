import type {
  MutationOperation,
  ProjectMutation,
  ProjectSnapshot,
  RevisionSummary,
} from "../src/engine/project/model";
import { applyOperations } from "../src/engine/project/mutations";
import { parseJson } from "./db/json";
import { ensureSchema } from "./db/schema";
import {
  WORKER_FEATURE_PERSISTENCE,
  workerFeaturesForReset,
  workerFeaturesForRestore,
  workerPortableFeatureRestoreStatements,
} from "./features/catalog";
import { json } from "./http";
import { loadProjectSettings, projectSettingsStatements } from "./projectSettingsStore";
import { getRunBookmarks } from "./runBookmarkStore";
import { WORKER_PROJECT_INTEGRITY_VALIDATORS } from "./features/validationCatalog";

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

function operationStatements(db: D1Database, operation: MutationOperation): D1PreparedStatement[] {
  for (const feature of WORKER_FEATURE_PERSISTENCE) {
    const statements = feature.mutationStatements(db, operation);
    if (statements) return statements;
  }

  switch (operation.type) {
    case "project.settings":
      return projectSettingsStatements(db, operation.settings);
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
  const projected = applyOperations(before, mutation.operations);
  for (const validate of WORKER_PROJECT_INTEGRITY_VALIDATORS) {
    const error = validate(before, projected);
    if (error) return json({ error }, { status: 400 });
  }
  const statements = mutation.operations.flatMap((operation) => operationStatements(db, operation));
  statements.push(
    db.prepare("INSERT INTO revisions (kind, entity_id, payload) VALUES (?, ?, ?)").bind(
      mutation.operations.length === 1 ? mutation.operations[0].type : "mutation.batch",
      "project",
      JSON.stringify({ description: mutation.description, beforeSnapshot: before }),
    ),
  );
  await db.batch(statements);
  return json({ snapshot: await getProjectSnapshot(db) });
}

/**
 * Canonical authored-project restore path. Undo and portable project import both
 * compose feature-owned reset/restore contributions through this function.
 * Author run bookmarks are intentionally outside this boundary.
 */
export function projectRestoreStatements(db: D1Database, snapshot: ProjectSnapshot): D1PreparedStatement[] {
  const featureDeletes = workerFeaturesForReset().flatMap((feature) => feature.resetStatements(db));
  const operations: MutationOperation[] = [
    { type: "project.settings", settings: snapshot.settings },
    ...workerFeaturesForRestore().flatMap((feature) => feature.restoreOperations(snapshot)),
  ];
  return [...featureDeletes, ...operations.flatMap((operation) => operationStatements(db, operation))];
}

export async function undo(db: D1Database, expectedRevision: number) {
  const revision = await currentRevision(db);
  if (revision !== expectedRevision) {
    return json({ error: "Project changed on another device.", currentRevision: revision }, { status: 409 });
  }
  const target = await db.prepare(
    `SELECT r.revision, r.payload
       FROM revisions r LEFT JOIN revision_undo u ON u.revision = r.revision
      WHERE r.kind <> 'undo'
        AND r.kind NOT IN ('bookmark.upsert', 'bookmark.delete')
        AND u.revision IS NULL
      ORDER BY r.revision DESC LIMIT 1`,
  ).first<{ revision: number; payload: string }>();
  if (!target) return json({ error: "Nothing to undo." }, { status: 404 });
  const payload = parseJson<{
    description?: string;
    beforeSnapshot?: ProjectSnapshot;
    beforeFeatureData?: Record<string, unknown>;
  }>(target.payload, {});
  if (!payload.beforeSnapshot) return json({ error: "This revision cannot be undone." }, { status: 409 });
  const current = await getProjectSnapshot(db);
  const statements = projectRestoreStatements(db, payload.beforeSnapshot);
  if (payload.beforeFeatureData) {
    statements.push(...workerPortableFeatureRestoreStatements(db, payload.beforeFeatureData));
  }
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
    db.prepare(
      `SELECT revision, kind, entity_id, payload, created_at
         FROM revisions
        WHERE kind NOT IN ('bookmark.upsert', 'bookmark.delete')
        ORDER BY revision DESC LIMIT 50`,
    ).all<{ revision: number; kind: string; entity_id: string; payload: string; created_at: string }>(),
    getRunBookmarks(db),
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
