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

function encodeBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function collectMediaObjects(bucket: R2Bucket | undefined) {
  if (!bucket) return [];
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: "media/", cursor });
    keys.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const contents = [];
  for (const key of keys.sort()) {
    const object = await bucket.get(key);
    if (!object) continue;
    contents.push({
      key,
      contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
      dataBase64: encodeBase64(await object.arrayBuffer()),
    });
  }
  return contents;
}

/** Complete portable backup: relational project state plus hosted media objects. */
export async function collectProjectBackup(db: BackupDatabase, bucket?: R2Bucket, exportedAt = new Date().toISOString()) {
  const [database, mediaObjects] = await Promise.all([
    collectD1Backup(db, exportedAt),
    collectMediaObjects(bucket),
  ]);
  return {
    format: "pre-programmed-project-backup",
    version: 2,
    exportedAt,
    database,
    mediaObjects,
  };
}
