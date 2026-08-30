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
  {
    id: 2,
    name: "general-authoring-primitives",
    sql: `
      CREATE TABLE IF NOT EXISTS node_details (
        node_id TEXT PRIMARY KEY,
        ending INTEGER NOT NULL DEFAULT 0 CHECK (ending IN (0, 1)),
        tags_json TEXT NOT NULL DEFAULT '[]',
        performance_json TEXT NOT NULL DEFAULT '{"charactersPerSecond":18,"cues":[]}',
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        source_node_id TEXT NOT NULL,
        wording TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS interaction_aliases (
        interaction_id TEXT NOT NULL,
        alias TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (interaction_id, alias),
        FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS interaction_outcomes (
        id TEXT PRIMARY KEY,
        interaction_id TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        label TEXT NOT NULL DEFAULT '',
        condition_json TEXT NOT NULL DEFAULT '{"type":"always"}',
        response_text TEXT NOT NULL DEFAULT '',
        effects_json TEXT NOT NULL DEFAULT '[]',
        disposition TEXT NOT NULL DEFAULT 'stay' CHECK (disposition IN ('stay', 'transition')),
        destination_node_id TEXT,
        FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE,
        FOREIGN KEY (destination_node_id) REFERENCES nodes(id)
      );

      CREATE TABLE IF NOT EXISTS variable_definitions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        value_type TEXT NOT NULL CHECK (value_type IN ('number', 'boolean', 'string')),
        initial_json TEXT NOT NULL,
        show_in_status INTEGER NOT NULL DEFAULT 0 CHECK (show_in_status IN (0, 1)),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS computed_definitions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        source TEXT NOT NULL,
        format TEXT NOT NULL DEFAULT 'raw',
        show_in_status INTEGER NOT NULL DEFAULT 0 CHECK (show_in_status IN (0, 1)),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS item_definitions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        asset_path TEXT NOT NULL DEFAULT '',
        width INTEGER NOT NULL DEFAULT 1 CHECK (width BETWEEN 1 AND 10),
        height INTEGER NOT NULL DEFAULT 1 CHECK (height BETWEEN 1 AND 6),
        stackable INTEGER NOT NULL DEFAULT 0 CHECK (stackable IN (0, 1)),
        max_stack INTEGER NOT NULL DEFAULT 1 CHECK (max_stack >= 1),
        removable INTEGER NOT NULL DEFAULT 1 CHECK (removable IN (0, 1)),
        tags_json TEXT NOT NULL DEFAULT '[]',
        initial_state_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS item_operation_hooks (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('inspect', 'use', 'move', 'remove')),
        order_index INTEGER NOT NULL DEFAULT 0,
        condition_json TEXT NOT NULL DEFAULT '{"type":"always"}',
        response_text TEXT NOT NULL DEFAULT '',
        effects_json TEXT NOT NULL DEFAULT '[]',
        success INTEGER NOT NULL DEFAULT 0 CHECK (success IN (0, 1)),
        FOREIGN KEY (item_id) REFERENCES item_definitions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS synth_sounds (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        recipe_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        traversal_json TEXT NOT NULL,
        play_state_json TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS revision_undo (
        revision INTEGER PRIMARY KEY,
        undone_by_revision INTEGER NOT NULL,
        FOREIGN KEY (revision) REFERENCES revisions(revision),
        FOREIGN KEY (undone_by_revision) REFERENCES revisions(revision)
      );

      INSERT OR IGNORE INTO node_details (node_id)
      SELECT id FROM nodes;

      CREATE INDEX IF NOT EXISTS interactions_source_idx ON interactions(source_node_id);
      CREATE INDEX IF NOT EXISTS aliases_interaction_idx ON interaction_aliases(interaction_id);
      CREATE INDEX IF NOT EXISTS outcomes_interaction_idx ON interaction_outcomes(interaction_id, order_index);
      CREATE INDEX IF NOT EXISTS hooks_item_idx ON item_operation_hooks(item_id, operation, order_index);
    `,
  },
  {
    id: 3,
    name: "characters-locations-and-node-context",
    sql: `
      CREATE TABLE IF NOT EXISTS entity_definitions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('character', 'location')),
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS node_context (
        node_id TEXT PRIMARY KEY,
        character_id TEXT,
        location_id TEXT,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (character_id) REFERENCES entity_definitions(id),
        FOREIGN KEY (location_id) REFERENCES entity_definitions(id)
      );

      INSERT OR IGNORE INTO node_context (node_id)
      SELECT id FROM nodes;
    `,
  },
];

let ready: Promise<void> | null = null;

export function splitSqlStatements(sql: string) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function executeSqlScript(db: D1Database, sql: string) {
  for (const statement of splitSqlStatements(sql)) {
    await db.prepare(statement).run();
  }
}

async function migrate(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const applied = await db.prepare("SELECT id FROM schema_migrations ORDER BY id").all<{ id: number }>();
  const appliedIds = new Set(applied.results.map((row) => row.id));

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;
    await executeSqlScript(db, migration.sql);
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
