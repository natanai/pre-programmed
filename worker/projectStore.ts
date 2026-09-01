import type {
  AuthorBookmark,
  GameNode,
  Interaction,
  MutationOperation,
  ProjectMutation,
  ProjectSnapshot,
  RevisionSummary,
} from "../src/game/model";
import { parseJson } from "./db/json";
import { ensureSchema } from "./db/migrations";
import { WORKER_FEATURE_PERSISTENCE } from "./features/catalog";
import { json } from "./http";
import { loadProjectSettings, projectSettingsStatements } from "./projectSettingsStore";

function groupRows<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

export async function currentRevision(db: D1Database) {
  const row = await db.prepare("SELECT COALESCE(MAX(revision), 0) AS revision FROM revisions")
    .first<{ revision: number }>();
  return row?.revision ?? 0;
}

type NodeRow = {
  id: string;
  node_number: number;
  text: string;
  characters_per_second: number;
  ending: number | null;
  tags_json: string | null;
  performance_json: string | null;
  character_id: string | null;
  location_id: string | null;
};
type InteractionRow = {
  id: string;
  source_node_id: string;
  wording: string;
  match_mode: Interaction["matchMode"];
  choice_visibility: Interaction["choiceVisibility"];
  tags_json: string;
  notes: string;
};
type AliasRow = { interaction_id: string; alias: string; order_index: number };
type OutcomeRow = {
  id: string;
  interaction_id: string;
  order_index: number;
  label: string;
  author_status: Interaction["outcomes"][number]["authorStatus"];
  condition_json: string;
  response_text: string;
  response_speaker_id: string | null;
  response_characters_per_second: number;
  effects_json: string;
  disposition: "stay" | "transition";
  destination_node_id: string | null;
};

export async function getProjectSnapshot(db: D1Database): Promise<ProjectSnapshot> {
  await ensureSchema(db);
  const [meta, settings, nodes, interactions, aliases, outcomes, featureSlices, revision] = await Promise.all([
    db.prepare("SELECT schema_version, start_node_id FROM project_meta WHERE id = 1")
      .first<{ schema_version: number; start_node_id: string }>(),
    loadProjectSettings(db),
    db.prepare(
      `SELECT n.id, n.node_number, n.text, n.characters_per_second,
              d.ending, d.tags_json, d.performance_json, c.character_id, c.location_id
         FROM nodes n
         LEFT JOIN node_details d ON d.node_id = n.id
         LEFT JOIN node_context c ON c.node_id = n.id
        ORDER BY n.node_number`,
    ).all<NodeRow>(),
    db.prepare("SELECT id, source_node_id, wording, match_mode, choice_visibility, tags_json, notes FROM interactions ORDER BY created_at, id")
      .all<InteractionRow>(),
    db.prepare("SELECT interaction_id, alias, order_index FROM interaction_aliases ORDER BY order_index, alias")
      .all<AliasRow>(),
    db.prepare(
      `SELECT id, interaction_id, order_index, label, author_status, condition_json, response_text, response_speaker_id,
              response_characters_per_second, effects_json, disposition, destination_node_id
         FROM interaction_outcomes ORDER BY interaction_id, order_index, id`,
    ).all<OutcomeRow>(),
    Promise.all(WORKER_FEATURE_PERSISTENCE.map((feature) => feature.load(db))),
    currentRevision(db),
  ]);

  if (!meta) throw new Error("Project has not been initialized.");
  const aliasGroups = groupRows(aliases.results, (row) => row.interaction_id);
  const outcomeGroups = groupRows(outcomes.results, (row) => row.interaction_id);
  const contributedProject = Object.assign({}, ...featureSlices) as Partial<ProjectSnapshot>;

  return {
    schemaVersion: Math.max(12, meta.schema_version),
    revision,
    startNodeId: meta.start_node_id,
    settings,
    nodes: nodes.results.map((row): GameNode => {
      const performance = parseJson(row.performance_json, {
        charactersPerSecond: row.characters_per_second,
        cues: [],
      });
      return {
        id: row.id,
        nodeNumber: row.node_number,
        text: row.text,
        ending: Boolean(row.ending),
        tags: parseJson(row.tags_json, []),
        characterId: row.character_id,
        locationId: row.location_id,
        performance: {
          charactersPerSecond: performance.charactersPerSecond ?? row.characters_per_second,
          cues: performance.cues ?? [],
        },
      };
    }),
    interactions: interactions.results.map((row): Interaction => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      wording: row.wording,
      matchMode: row.match_mode ?? "command",
      choiceVisibility: row.choice_visibility,
      tags: parseJson(row.tags_json, []),
      notes: row.notes,
      aliases: (aliasGroups.get(row.id) ?? []).map((alias) => alias.alias),
      outcomes: (outcomeGroups.get(row.id) ?? []).map((outcome) => ({
        id: outcome.id,
        order: outcome.order_index,
        label: outcome.label,
        authorStatus: outcome.author_status,
        condition: parseJson(outcome.condition_json, { type: "always" }),
        responseText: outcome.response_text,
        speakerId: outcome.response_speaker_id,
        responseCharactersPerSecond: outcome.response_characters_per_second,
        effects: parseJson(outcome.effects_json, []),
        disposition: outcome.disposition,
        destinationNodeId: outcome.destination_node_id,
      })),
    })),
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
    case "node.upsert": {
      const { node } = operation;
      return [
        db.prepare(
          `INSERT INTO nodes (id, node_number, text, characters_per_second, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET node_number=excluded.node_number, text=excluded.text,
             characters_per_second=excluded.characters_per_second, updated_at=CURRENT_TIMESTAMP`,
        ).bind(node.id, node.nodeNumber, node.text, node.performance.charactersPerSecond),
        db.prepare(
          `INSERT INTO node_details (node_id, ending, tags_json, performance_json)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(node_id) DO UPDATE SET ending=excluded.ending, tags_json=excluded.tags_json,
             performance_json=excluded.performance_json`,
        ).bind(node.id, Number(node.ending), JSON.stringify(node.tags), JSON.stringify(node.performance)),
        db.prepare(
          `INSERT INTO node_context (node_id, character_id, location_id)
           VALUES (?, ?, ?)
           ON CONFLICT(node_id) DO UPDATE SET character_id=excluded.character_id,
             location_id=excluded.location_id`,
        ).bind(node.id, node.characterId, node.locationId),
      ];
    }
    case "interaction.upsert": {
      const value = operation.interaction;
      return [
        db.prepare(
          `INSERT INTO interactions (id, source_node_id, wording, match_mode, choice_visibility, tags_json, notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET source_node_id=excluded.source_node_id, wording=excluded.wording,
             match_mode=excluded.match_mode, choice_visibility=excluded.choice_visibility, tags_json=excluded.tags_json,
             notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          value.id,
          value.sourceNodeId,
          value.wording,
          value.matchMode ?? "command",
          value.choiceVisibility ?? "prompt",
          JSON.stringify(value.tags),
          value.notes,
        ),
        db.prepare("DELETE FROM interaction_aliases WHERE interaction_id = ?").bind(value.id),
        db.prepare("DELETE FROM interaction_outcomes WHERE interaction_id = ?").bind(value.id),
        ...value.aliases.map((alias, index) => db.prepare("INSERT INTO interaction_aliases (interaction_id, alias, order_index) VALUES (?, ?, ?)").bind(value.id, alias, index)),
        ...value.outcomes.map((outcome) => db.prepare(
          `INSERT INTO interaction_outcomes
           (id, interaction_id, order_index, label, condition_json, response_text, response_speaker_id,
            response_characters_per_second, effects_json, disposition, destination_node_id, author_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          outcome.id,
          value.id,
          outcome.order,
          outcome.label,
          JSON.stringify(outcome.condition),
          outcome.responseText,
          outcome.speakerId ?? null,
          outcome.responseCharactersPerSecond ?? 18,
          JSON.stringify(outcome.effects),
          outcome.disposition,
          outcome.destinationNodeId,
          outcome.authorStatus ?? "configured",
        )),
      ];
    }
    case "interaction.delete":
      return [db.prepare("DELETE FROM interactions WHERE id = ?").bind(operation.id)];
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
  const deletes = [
    "DELETE FROM interaction_aliases",
    "DELETE FROM interaction_outcomes",
    "DELETE FROM interactions",
    "DELETE FROM bookmarks",
    "DELETE FROM node_context",
    "DELETE FROM node_details",
    "DELETE FROM nodes WHERE id <> (SELECT start_node_id FROM project_meta WHERE id = 1)",
  ].map((sql) => db.prepare(sql));
  const featureDeletes = WORKER_FEATURE_PERSISTENCE.flatMap((feature) => feature.resetStatements(db));
  const operations: MutationOperation[] = [
    { type: "project.settings", settings: snapshot.settings },
    ...snapshot.nodes.map((node) => ({ type: "node.upsert" as const, node })),
    ...snapshot.interactions.map((interaction) => ({ type: "interaction.upsert" as const, interaction })),
    ...bookmarks.map((bookmark) => ({ type: "bookmark.upsert" as const, bookmark })),
    ...WORKER_FEATURE_PERSISTENCE.flatMap((feature) => feature.restoreOperations(snapshot)),
  ];
  return [...deletes, ...featureDeletes, ...operations.flatMap((operation) => operationStatements(db, operation))];
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
