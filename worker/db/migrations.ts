type Migration = {
  id: number;
  name: string;
  sql: string;
};

const migrations: Migration[] = [
  {
    id: 1,
    name: "initial-world",
    sql: `
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        node_number INTEGER NOT NULL UNIQUE,
        text TEXT NOT NULL,
        characters_per_second INTEGER NOT NULL DEFAULT 18 CHECK (characters_per_second BETWEEN 1 AND 120),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS project_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schema_version INTEGER NOT NULL DEFAULT 1,
        start_node_id TEXT NOT NULL,
        FOREIGN KEY (start_node_id) REFERENCES nodes(id)
      );

      CREATE TABLE IF NOT EXISTS revisions (
        revision INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR IGNORE INTO nodes (id, node_number, text, characters_per_second)
      VALUES (
        '00000000-0000-4000-8000-000000000001',
        1,
        'you are born',
        18
      );

      INSERT OR IGNORE INTO project_meta (id, schema_version, start_node_id)
      VALUES (
        1,
        1,
        '00000000-0000-4000-8000-000000000001'
      );
    `,
  },
];

let ready: Promise<void> | null = null;

async function migrate(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = await db.prepare("SELECT id FROM schema_migrations ORDER BY id").all<{ id: number }>();
  const appliedIds = new Set(applied.results.map((row) => row.id));

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;
    await db.exec(migration.sql);
    await db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)")
      .bind(migration.id, migration.name)
      .run();
  }
}

export function ensureSchema(db: D1Database) {
  if (!ready) {
    ready = migrate(db).catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
