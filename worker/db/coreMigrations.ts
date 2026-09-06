import type { WorkerMigration } from "./migrationContract";

/**
 * Core/platform schema migrations that do not belong to an authored game feature.
 * Feature schema remains beside each feature; this list is for shared engine
 * infrastructure such as Author workspace state.
 */
export const CORE_PLATFORM_MIGRATIONS: readonly WorkerMigration[] = [
  {
    id: 41,
    name: "separate-and-repair-author-run-bookmarks",
    sql: `
      DROP TABLE IF EXISTS bookmarks_v41;

      CREATE TABLE bookmarks_v41 (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        traversal_json TEXT NOT NULL,
        play_state_json TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      INSERT INTO bookmarks_v41
        (id, node_id, traversal_json, play_state_json, note, created_at)
      SELECT id, node_id, traversal_json, play_state_json, note, created_at
      FROM bookmarks;

      DROP TABLE bookmarks;
      ALTER TABLE bookmarks_v41 RENAME TO bookmarks;

      WITH historical_bookmarks AS (
        SELECT
          r.revision,
          json_extract(bookmark.value, '$.id') AS id,
          json_extract(bookmark.value, '$.nodeId') AS node_id,
          json_extract(bookmark.value, '$.traversal') AS traversal_json,
          json_extract(bookmark.value, '$.playState') AS play_state_json,
          COALESCE(json_extract(bookmark.value, '$.note'), '') AS note,
          json_extract(bookmark.value, '$.createdAt') AS created_at
        FROM revisions r,
             json_each(
               CASE WHEN json_valid(r.payload) THEN r.payload ELSE '{}' END,
               '$.beforeBookmarks'
             ) AS bookmark
        WHERE json_valid(r.payload)
          AND json_type(
            CASE WHEN json_valid(r.payload) THEN r.payload ELSE '{}' END,
            '$.beforeBookmarks'
          ) = 'array'
          AND trim(COALESCE(json_extract(bookmark.value, '$.note'), '')) <> ''
          AND json_extract(bookmark.value, '$.id') IS NOT NULL
          AND json_extract(bookmark.value, '$.nodeId') IS NOT NULL
          AND json_extract(bookmark.value, '$.createdAt') IS NOT NULL
      ),
      latest_bookmarks AS (
        SELECT historical.*
        FROM historical_bookmarks historical
        JOIN (
          SELECT id, MAX(revision) AS revision
          FROM historical_bookmarks
          GROUP BY id
        ) latest
          ON latest.id = historical.id
         AND latest.revision = historical.revision
      ),
      explicit_deletes AS (
        SELECT historical.id, MAX(historical.revision) AS deleted_revision
        FROM historical_bookmarks historical
        JOIN revisions revision ON revision.revision = historical.revision
        WHERE revision.kind = 'bookmark.delete'
          AND (
            json_extract(revision.payload, '$.description') = 'Deleted saved location: ' || historical.note
            OR json_extract(revision.payload, '$.description') = 'Deleted run bookmark: ' || historical.note
          )
        GROUP BY historical.id
      )
      INSERT OR IGNORE INTO bookmarks
        (id, node_id, traversal_json, play_state_json, note, created_at)
      SELECT
        latest.id,
        latest.node_id,
        latest.traversal_json,
        latest.play_state_json,
        latest.note,
        latest.created_at
      FROM latest_bookmarks latest
      LEFT JOIN explicit_deletes deleted ON deleted.id = latest.id
      WHERE deleted.deleted_revision IS NULL
         OR deleted.deleted_revision < latest.revision;

      UPDATE project_meta SET schema_version = 41 WHERE id = 1;
    `,
  },
];
