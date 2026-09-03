export type BackupDatabase = Pick<D1Database, "prepare">;

type SchemaRow = {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
};

function quoteIdentifier(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function collectD1Backup(db: BackupDatabase, exportedAt = new Date().toISOString()) {
  const schemaResult = await db.prepare(
    `SELECT type, name, tbl_name, sql
       FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_cf_%'
        AND sql IS NOT NULL
      ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`,
  ).all<SchemaRow>();
  const schema = schemaResult.results.filter(
    (entry) => !entry.name.startsWith("sqlite_") && !entry.name.startsWith("_cf_"),
  );

  const tables: Record<string, unknown[]> = {};
  for (const entry of schema) {
    if (entry.type !== "table") continue;
    const rows = await db.prepare(`SELECT * FROM ${quoteIdentifier(entry.name)}`).all();
    tables[entry.name] = rows.results;
  }

  return {
    format: "pre-programmed-d1-backup",
    version: 1,
    exportedAt,
    schema,
    tables,
  };
}

/**
 * Portable authored-state backup. Generated SVG content and synth definitions are
 * already inside D1. Binary repository Media is version-controlled with the game
 * and therefore is intentionally outside this database export.
 */
export async function collectProjectBackup(db: BackupDatabase, exportedAt = new Date().toISOString()) {
  return {
    format: "pre-programmed-project-backup",
    version: 3,
    exportedAt,
    database: await collectD1Backup(db, exportedAt),
    repositoryMedia: "version-controlled" as const,
  };
}
