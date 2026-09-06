import type { ProjectSnapshot } from "../src/engine/project/model";
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
export const PORTABLE_PROJECT_VERSION = 2 as const;

type PortableProjectSnapshot = Omit<ProjectSnapshot, "revision">;

export type PortableProjectDocument = {
  format: typeof PORTABLE_PROJECT_FORMAT;
  /**
   * Portable release boundary, not a promise to preserve arbitrary prototype
   * revisions. Future releases may migrate deliberate prior portable versions
   * forward into the then-current canonical project model.
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

function parseCurrent(value: Record<string, unknown>): PortableProjectDocument {
  if (!isRecord(value.project)) throw new Error("Portable project is missing project data.");
  if (!isRecord(value.featureData)) throw new Error("Portable project has invalid feature data.");
  const project = value.project as unknown as PortableProjectSnapshot;
  if (!Number.isInteger(project.schemaVersion) || !isRecord(project.settings)
    || !Array.isArray(project.nodes) || !Array.isArray(project.interactions)) {
    throw new Error("Portable project does not contain a valid project snapshot.");
  }
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
  if (!Array.isArray(value.bookmarks)) throw new Error("Portable project has invalid saved author locations.");
  return parseCurrent(value);
}

/**
 * Migrate only deliberate portable-project release formats. Version 1 carried
 * Author run bookmarks inside the authored game by mistake; migration discards
 * that installation-local state instead of importing it into another run.
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
