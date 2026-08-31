import type {
  AuthorBookmark,
  ComputedDefinition,
  EntityDefinition,
  GameNode,
  Interaction,
  ItemDefinition,
  MutationOperation,
  OperationHook,
  OperationId,
  ProjectMutation,
  ProjectSnapshot,
  RevisionSummary,
  SynthSound,
  VariableDefinition,
} from "../src/game/model";
import { ensureSchema } from "./db/migrations";
import { json } from "./http";
import { loadProjectSettings, projectSettingsStatements } from "./projectSettingsStore";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

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
  response_characters_per_second: number;
  effects_json: string;
  disposition: "stay" | "transition";
  destination_node_id: string | null;
};
type EntityRow = {
  id: string;
  key: string;
  entity_type: "character" | "location";
  name: string;
  description: string;
  tags_json: string;
};
type VariableRow = {
  id: string;
  key: string;
  label: string;
  value_type: "number" | "boolean" | "string";
  initial_json: string;
  show_in_status: number;
  operation_interactable: number;
  operations_json: string;
  time_rate: number;
  time_unit: "second" | "minute" | "hour";
};
type ComputedRow = {
  id: string;
  key: string;
  label: string;
  source: ComputedDefinition["source"];
  format: ComputedDefinition["format"];
  show_in_status: number;
  operation_interactable: number;
  operations_json: string;
};
type ItemRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  asset_path: string;
  width: number;
  height: number;
  stackable: number;
  max_stack: number;
  removable: number;
  starting_quantity: number;
  operation_interactable: number;
  operations_json: string;
  tags_json: string;
  initial_state_json: string;
};
type HookRow = {
  id: string;
  target_kind: "item" | "variable" | "computed";
  target_id: string;
  operation: OperationId;
  order_index: number;
  condition_json: string;
  response_text: string;
  effects_json: string;
  success: number;
};
type SynthRow = { id: string; key: string; label: string; recipe_json: string };

export async function getProjectSnapshot(db: D1Database): Promise<ProjectSnapshot> {
  await ensureSchema(db);
  const [meta, settings, nodes, interactions, aliases, outcomes, entities, variables, computed, items, hooks, synths, revision] =
    await Promise.all([
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
        `SELECT id, interaction_id, order_index, label, author_status, condition_json, response_text, response_characters_per_second,
                effects_json, disposition, destination_node_id
           FROM interaction_outcomes ORDER BY interaction_id, order_index, id`,
      ).all<OutcomeRow>(),
      db.prepare(
        "SELECT id, key, entity_type, name, description, tags_json FROM entity_definitions ORDER BY entity_type, key",
      ).all<EntityRow>(),
      db.prepare(
        "SELECT id, key, label, value_type, initial_json, show_in_status, operation_interactable, operations_json, time_rate, time_unit FROM variable_definitions ORDER BY key",
      ).all<VariableRow>(),
      db.prepare(
        "SELECT id, key, label, source, format, show_in_status, operation_interactable, operations_json FROM computed_definitions ORDER BY key",
      ).all<ComputedRow>(),
      db.prepare(
        `SELECT id, key, name, description, asset_path, width, height, stackable,
                max_stack, removable, starting_quantity, operation_interactable, operations_json,
                tags_json, initial_state_json
           FROM item_definitions ORDER BY key`,
      ).all<ItemRow>(),
      db.prepare(
        `SELECT id, target_kind, target_id, operation, order_index, condition_json, response_text,
                effects_json, success FROM operation_hooks ORDER BY target_kind, target_id, operation, order_index, id`,
      ).all<HookRow>(),
      db.prepare("SELECT id, key, label, recipe_json FROM synth_sounds ORDER BY key").all<SynthRow>(),
      currentRevision(db),
    ]);

  if (!meta) throw new Error("Project has not been initialized.");
  const aliasGroups = groupRows(aliases.results, (row) => row.interaction_id);
  const outcomeGroups = groupRows(outcomes.results, (row) => row.interaction_id);
  const hookGroups = groupRows(hooks.results, (row) => `${row.target_kind}:${row.target_id}`);
  const hooksFor = (kind: HookRow["target_kind"], id: string) => (hookGroups.get(`${kind}:${id}`) ?? []).map((hook) => ({
    id: hook.id,
    operation: hook.operation,
    order: hook.order_index,
    condition: parseJson(hook.condition_json, { type: "always" } as const),
    responseText: hook.response_text,
    effects: parseJson(hook.effects_json, []),
    success: Boolean(hook.success),
  }));

  return {
    schemaVersion: Math.max(10, meta.schema_version),
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
        responseCharactersPerSecond: outcome.response_characters_per_second,
        effects: parseJson(outcome.effects_json, []),
        disposition: outcome.disposition,
        destinationNodeId: outcome.destination_node_id,
      })),
    })),
    entities: entities.results.map((row): EntityDefinition => ({
      id: row.id,
      key: row.key,
      type: row.entity_type,
      name: row.name,
      description: row.description,
      tags: parseJson(row.tags_json, []),
    })),
    variables: variables.results.map((row): VariableDefinition => ({
      id: row.id,
      key: row.key,
      label: row.label,
      valueType: row.value_type,
      initialValue: parseJson(row.initial_json, null),
      showInStatus: Boolean(row.show_in_status),
      interactable: Boolean(row.operation_interactable),
      operations: parseJson(row.operations_json, []),
      hooks: hooksFor("variable", row.id),
      timeRate: row.time_rate,
      timeUnit: row.time_unit,
    })),
    computedValues: computed.results.map((row): ComputedDefinition => ({
      id: row.id,
      key: row.key,
      label: row.label,
      source: row.source,
      format: row.format,
      showInStatus: Boolean(row.show_in_status),
      interactable: Boolean(row.operation_interactable),
      operations: parseJson(row.operations_json, []),
      hooks: hooksFor("computed", row.id),
    })),
    items: items.results.map((row): ItemDefinition => ({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      assetPath: row.asset_path,
      width: row.width,
      height: row.height,
      stackable: Boolean(row.stackable),
      maxStack: row.max_stack,
      removable: Boolean(row.removable),
      startingQuantity: row.starting_quantity,
      interactable: Boolean(row.operation_interactable),
      operations: parseJson(row.operations_json, ["inspect", "use", "move", "remove"]),
      tags: parseJson(row.tags_json, []),
      initialState: parseJson(row.initial_state_json, {}),
      hooks: hooksFor("item", row.id),
    })),
    synthSounds: synths.results.map((row): SynthSound => ({
      ...parseJson<Omit<SynthSound, "id" | "key" | "label">>(row.recipe_json, {
        tempo: 120,
        loop: false,
        voices: [],
      }),
      id: row.id,
      key: row.key,
      label: row.label,
    })),
  };
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

function hookStatements(
  db: D1Database,
  targetKind: HookRow["target_kind"],
  targetId: string,
  hooks: OperationHook[] = [],
) {
  return [
    db.prepare("DELETE FROM operation_hooks WHERE target_kind = ? AND target_id = ?").bind(targetKind, targetId),
    ...hooks.map((hook) => db.prepare(
      `INSERT INTO operation_hooks
       (id, target_kind, target_id, operation, order_index, condition_json, response_text, effects_json, success)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      hook.id, targetKind, targetId, hook.operation, hook.order, JSON.stringify(hook.condition),
      hook.responseText, JSON.stringify(hook.effects), Number(hook.success),
    )),
  ];
}

function operationStatements(db: D1Database, operation: MutationOperation): D1PreparedStatement[] {
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
           (id, interaction_id, order_index, label, condition_json, response_text,
            response_characters_per_second, effects_json, disposition, destination_node_id, author_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          outcome.id,
          value.id,
          outcome.order,
          outcome.label,
          JSON.stringify(outcome.condition),
          outcome.responseText,
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
    case "entity.upsert": {
      const entity = operation.entity;
      return [db.prepare(
        `INSERT INTO entity_definitions (id, key, entity_type, name, description, tags_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET key=excluded.key, entity_type=excluded.entity_type,
           name=excluded.name, description=excluded.description, tags_json=excluded.tags_json,
           updated_at=CURRENT_TIMESTAMP`,
      ).bind(entity.id, entity.key, entity.type, entity.name, entity.description, JSON.stringify(entity.tags))];
    }
    case "variable.upsert": {
      const value = operation.definition;
      return [db.prepare(
        `INSERT INTO variable_definitions
         (id, key, label, value_type, initial_json, show_in_status, operation_interactable, operations_json, time_rate, time_unit, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label, value_type=excluded.value_type,
           initial_json=excluded.initial_json, show_in_status=excluded.show_in_status,
           operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
           time_rate=excluded.time_rate, time_unit=excluded.time_unit,
           updated_at=CURRENT_TIMESTAMP`,
      ).bind(
        value.id, value.key, value.label, value.valueType, JSON.stringify(value.initialValue), Number(value.showInStatus),
        Number(value.interactable ?? false), JSON.stringify(value.operations ?? []), value.timeRate ?? 0, value.timeUnit ?? "second",
      ), ...hookStatements(db, "variable", value.id, value.hooks)];
    }
    case "computed.upsert": {
      const value = operation.definition;
      return [db.prepare(
        `INSERT INTO computed_definitions
         (id, key, label, source, format, show_in_status, operation_interactable, operations_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label, source=excluded.source,
           format=excluded.format, show_in_status=excluded.show_in_status,
           operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
           updated_at=CURRENT_TIMESTAMP`,
      ).bind(
        value.id, value.key, value.label, value.source, value.format, Number(value.showInStatus),
        Number(value.interactable ?? false), JSON.stringify(value.operations ?? []),
      ), ...hookStatements(db, "computed", value.id, value.hooks)];
    }
    case "item.upsert": {
      const item = operation.item;
      return [
        db.prepare(
          `INSERT INTO item_definitions
           (id, key, name, description, asset_path, width, height, stackable, max_stack,
            removable, starting_quantity, operation_interactable, operations_json,
            tags_json, initial_state_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET key=excluded.key, name=excluded.name,
             description=excluded.description, asset_path=excluded.asset_path, width=excluded.width,
             height=excluded.height, stackable=excluded.stackable, max_stack=excluded.max_stack,
             removable=excluded.removable, starting_quantity=excluded.starting_quantity,
             operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
             tags_json=excluded.tags_json,
             initial_state_json=excluded.initial_state_json, updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          item.id, item.key, item.name, item.description, item.assetPath, item.width, item.height,
          Number(item.stackable), item.maxStack, Number(item.removable), item.startingQuantity ?? 0,
          Number(item.interactable ?? true), JSON.stringify(item.operations ?? ["inspect", "use", "move", "remove"]),
          JSON.stringify(item.tags), JSON.stringify(item.initialState),
        ),
        ...hookStatements(db, "item", item.id, item.hooks),
      ];
    }
    case "synth.upsert": {
      const sound = operation.sound;
      const { id: _id, key: _key, label: _label, ...recipe } = sound;
      return [db.prepare(
        `INSERT INTO synth_sounds (id, key, label, recipe_json, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label,
           recipe_json=excluded.recipe_json, updated_at=CURRENT_TIMESTAMP`,
      ).bind(sound.id, sound.key, sound.label, JSON.stringify(recipe))];
    }
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
    "DELETE FROM operation_hooks",
    "DELETE FROM item_definitions",
    "DELETE FROM variable_definitions",
    "DELETE FROM computed_definitions",
    "DELETE FROM synth_sounds",
    "DELETE FROM bookmarks",
    "DELETE FROM node_context",
    "DELETE FROM node_details",
    "DELETE FROM nodes WHERE id <> (SELECT start_node_id FROM project_meta WHERE id = 1)",
    "DELETE FROM entity_definitions",
  ].map((sql) => db.prepare(sql));
  const operations: MutationOperation[] = [
    { type: "project.settings", settings: snapshot.settings },
    ...snapshot.entities.map((entity) => ({ type: "entity.upsert" as const, entity })),
    ...snapshot.nodes.map((node) => ({ type: "node.upsert" as const, node })),
    ...snapshot.interactions.map((interaction) => ({ type: "interaction.upsert" as const, interaction })),
    ...snapshot.variables.map((definition) => ({ type: "variable.upsert" as const, definition })),
    ...snapshot.computedValues.map((definition) => ({ type: "computed.upsert" as const, definition })),
    ...snapshot.items.map((item) => ({ type: "item.upsert" as const, item })),
    ...snapshot.synthSounds.map((sound) => ({ type: "synth.upsert" as const, sound })),
    ...bookmarks.map((bookmark) => ({ type: "bookmark.upsert" as const, bookmark })),
  ];
  return [...deletes, ...operations.flatMap((operation) => operationStatements(db, operation))];
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
