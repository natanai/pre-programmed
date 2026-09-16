import type { ProjectSnapshot } from "../src/engine/project/model";
import { normalizeProjectSnapshot } from "../src/engine/project/settings";
import {
  collectWorkerPortableFeatureData,
  workerPortableFeatureRestoreStatements,
} from "./features/catalog";
import { WORKER_PROJECT_INTEGRITY_VALIDATORS } from "./features/validationCatalog";
import {
  getProjectSnapshot,
  projectRestoreStatements,
} from "./projectStore";

export const PORTABLE_PROJECT_FORMAT = "pre-programmed-project" as const;
export const PORTABLE_PROJECT_VERSION = 3 as const;

type PortableProjectSnapshot = Omit<ProjectSnapshot, "revision">;

export type PortableProjectDocument = {
  format: typeof PORTABLE_PROJECT_FORMAT;
  /**
   * Portable release boundary, not a promise to preserve arbitrary prototype
   * revisions. Deliberate prior portable versions are migrated one-way into the
   * current canonical project model before any runtime or Author code sees them.
   */
  version: typeof PORTABLE_PROJECT_VERSION;
  exportedAt: string;
  sourceSchemaVersion: number;
  project: PortableProjectSnapshot;
  featureData: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalPortableProject(project: Record<string, unknown>): PortableProjectSnapshot {
  const normalized = normalizeProjectSnapshot({
    ...project,
    revision: 0,
  } as Parameters<typeof normalizeProjectSnapshot>[0]);
  const { revision: _revision, ...portable } = normalized;
  return portable;
}

function parseCurrent(value: Record<string, unknown>): PortableProjectDocument {
  if (!isRecord(value.project)) throw new Error("Portable project is missing project data.");
  if (!isRecord(value.featureData)) throw new Error("Portable project has invalid feature data.");
  if (!Number.isInteger(value.project.schemaVersion) || !isRecord(value.project.settings)
    || !Array.isArray(value.project.nodes) || !Array.isArray(value.project.interactions)) {
    throw new Error("Portable project does not contain a valid project snapshot.");
  }
  const project = canonicalPortableProject(value.project);
  return {
    format: PORTABLE_PROJECT_FORMAT,
    version: PORTABLE_PROJECT_VERSION,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : "",
    sourceSchemaVersion: Number.isInteger(value.sourceSchemaVersion)
      ? value.sourceSchemaVersion as number
      : project.schemaVersion,
    project,
    featureData: value.featureData,
  };
}

function parseVersionOne(value: Record<string, unknown>) {
  if (!Array.isArray(value.bookmarks)) throw new Error("Portable project has invalid legacy run bookmark data.");
  return parseCurrent(value);
}

/**
 * Migrate only deliberate portable-project release formats. Version 1 carried
 * Author run bookmarks inside authored game data; version 2 still stored Node
 * prose directly on the Node. Both are translated once at this import boundary.
 */
export function migratePortableProject(value: unknown): PortableProjectDocument {
  if (!isRecord(value) || value.format !== PORTABLE_PROJECT_FORMAT || !Number.isInteger(value.version)) {
    throw new Error("This is not a Pre-Programmed portable project file.");
  }
  const version = value.version as number;
  if (version > PORTABLE_PROJECT_VERSION) {
    throw new Error(`This project was created by a newer portable format (${version}). Update Pre-Programmed before importing it.`);
  }
  switch (version) {
    case 1:
      return parseVersionOne(value);
    case 2:
      return parseCurrent(value);
    case 3:
      return parseCurrent(value);
    default:
      throw new Error(`Portable project format ${version} is no longer supported by this engine release.`);
  }
}

export async function collectPortableProject(db: D1Database, exportedAt = new Date().toISOString()): Promise<PortableProjectDocument> {
  const [snapshot, featureData] = await Promise.all([
    getProjectSnapshot(db),
    collectWorkerPortableFeatureData(db),
  ]);
  const { revision: _revision, ...project } = snapshot;
  return {
    format: PORTABLE_PROJECT_FORMAT,
    version: PORTABLE_PROJECT_VERSION,
    exportedAt,
    sourceSchemaVersion: snapshot.schemaVersion,
    project,
    featureData,
  };
}

export async function restorePortableProject(db: D1Database, input: unknown) {
  const document = migratePortableProject(input);
  const [before, beforeFeatureData] = await Promise.all([
    getProjectSnapshot(db),
    collectWorkerPortableFeatureData(db),
  ]);
  const imported = { ...document.project, revision: before.revision } as ProjectSnapshot;

  for (const validate of WORKER_PROJECT_INTEGRITY_VALIDATORS) {
    const error = validate(before, imported);
    if (error) throw new Error(`Portable project is not valid for the current engine: ${error}`);
  }

  const statements = [
    ...projectRestoreStatements(db, imported),
    ...workerPortableFeatureRestoreStatements(db, document.featureData),
  ];
  statements.push(
    db.prepare("INSERT INTO revisions (kind, entity_id, payload) VALUES (?, ?, ?)").bind(
      "project.import",
      "project",
      JSON.stringify({
        description: `Import portable project format ${document.version}`,
        beforeSnapshot: before,
        beforeFeatureData,
      }),
    ),
  );
  await db.batch(statements);
  return getProjectSnapshot(db);
}
