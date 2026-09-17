import {
  nodeConversationCharacterId,
  nodeConversationMode,
  nodeLocationMode,
  normalizeNodeContext,
} from "../../src/features/narrative/sceneContext";
import { normalizeInteractionOutcomeProse } from "../../src/features/narrative/interactionProse";
import type { GameNode, Interaction, InteractionInputCapture, NodeOpening, TextPerformance } from "../../src/features/narrative/model";
import { legacyAssetId } from "../../src/features/media/assetReference";
import { parseJson } from "../db/json";
import type { WorkerFeaturePersistence } from "./types";

function groupRows<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

const DEFAULT_TEXT_PERFORMANCE: TextPerformance = { charactersPerSecond: 18, cues: [] };

type NodeRow = {
  id: string;
  node_number: number;
  author_label: string;
  ending: number | null;
  tags_json: string | null;
  entry_effects_json: string | null;
  location_id: string | null;
  location_mode: "set" | "continue" | "clear" | null;
  conversation_mode: "set" | "continue" | "clear" | null;
  conversation_character_id: string | null;
  anchor_mode: "set" | "continue" | "clear" | null;
  anchor_text: string | null;
};

type OpeningRow = {
  id: string;
  node_id: string;
  order_index: number;
  condition_json: string;
  narration_text: string;
  dialogue_text: string;
  narration_performance_json: string;
  dialogue_performance_json: string;
};

type InteractionRow = {
  id: string;
  source_node_id: string;
  order_index: number;
  wording: string;
  match_mode: "command" | "fallback";
  capture_input: number;
  choice_visibility: Interaction["choiceVisibility"];
  tags_json: string;
  notes: string;
};

type InteractionChoiceVisibilityRow = {
  interaction_id: string;
  condition_json: string;
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
  response_dialogue_text: string;
  response_speaker_id: string | null;
  response_characters_per_second: number;
  response_performance_json: string;
  response_dialogue_performance_json: string;
  effects_json: string;
  input_capture_json: string | null;
  disposition: "stay" | "transition";
  destination_node_id: string | null;
  destination_opening_id: string | null;
};

function migrateLegacyMediaEffects(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((effect) => {
    if (!effect || typeof effect !== "object") return effect;
    const candidate = effect as Record<string, unknown>;
    if ((candidate.type === "audio" || candidate.type === "art")
      && typeof candidate.assetPath === "string" && typeof candidate.assetId !== "string") {
      const { assetPath, ...rest } = candidate;
      return { ...rest, assetId: legacyAssetId(assetPath) };
    }
    return effect;
  });
}

function migrateLegacyMediaCues<T extends { cues?: Array<{ type: string; value?: unknown }> }>(performance: T): T {
  return {
    ...performance,
    cues: (performance.cues ?? []).map((cue) => (
      (cue.type === "audio" || cue.type === "sprite") && typeof cue.value === "string"
        ? { ...cue, value: legacyAssetId(cue.value) }
        : cue
    )),
  };
}

function parseInputCapture(value: string | null): InteractionInputCapture | null {
  const capture = parseJson<InteractionInputCapture | null>(value, null);
  if (!capture) return null;
  return {
    ...capture,
    effects: migrateLegacyMediaEffects(capture.effects) as InteractionInputCapture["effects"],
    destination: capture.destination ?? null,
  };
}

function normalizeNodeForPersistence(value: GameNode): GameNode {
  return normalizeNodeContext({
    ...value,
    authorLabel: value.authorLabel.trim(),
    openings: [...value.openings]
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .map((opening, order) => ({ ...opening, order })),
  });
}

export const narrativeFeaturePersistence: WorkerFeaturePersistence = {
  id: "narrative",
  migrations: [
    {
      id: 17,
      name: "narrative-shared-authored-text-performance",
      sql: `
        ALTER TABLE interaction_outcomes
        ADD COLUMN response_performance_json TEXT NOT NULL DEFAULT '{"charactersPerSecond":18,"cues":[]}';

        UPDATE interaction_outcomes
        SET response_performance_json = json_object(
          'charactersPerSecond', response_characters_per_second,
          'cues', json('[]')
        );

        UPDATE project_meta SET schema_version = 17 WHERE id = 1;
      `,
    },
    {
      id: 33,
      name: "narrative-interaction-choice-visibility-conditions",
      sql: `
        CREATE TABLE IF NOT EXISTS interaction_choice_visibility_conditions (
          interaction_id TEXT PRIMARY KEY,
          condition_json TEXT NOT NULL DEFAULT '{"type":"always"}',
          FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE
        );

        UPDATE project_meta SET schema_version = 33 WHERE id = 1;
      `,
    },
    {
      id: 34,
      name: "narrative-node-anchors",
      sql: `
        ALTER TABLE node_details
        ADD COLUMN anchor_mode TEXT NOT NULL DEFAULT 'continue'
        CHECK (anchor_mode IN ('set', 'continue', 'clear'));

        ALTER TABLE node_details
        ADD COLUMN anchor_text TEXT NOT NULL DEFAULT '';

        UPDATE project_meta SET schema_version = 34 WHERE id = 1;
      `,
    },
    {
      id: 35,
      name: "narrative-persistent-node-locations",
      sql: `
        ALTER TABLE node_context
        ADD COLUMN location_mode TEXT NOT NULL DEFAULT 'continue'
        CHECK (location_mode IN ('set', 'continue', 'clear'));

        UPDATE node_context
        SET location_mode = CASE WHEN location_id IS NOT NULL THEN 'set' ELSE 'continue' END;

        UPDATE project_meta SET schema_version = 35 WHERE id = 1;
      `,
    },
    {
      id: 36,
      name: "narrative-player-input-capture",
      sql: `
        ALTER TABLE interactions
        ADD COLUMN capture_input INTEGER NOT NULL DEFAULT 0
        CHECK (capture_input IN (0, 1));

        CREATE UNIQUE INDEX interactions_one_capture_per_node
        ON interactions(source_node_id)
        WHERE capture_input = 1;

        UPDATE project_meta SET schema_version = 36 WHERE id = 1;
      `,
    },
    {
      id: 37,
      name: "narrative-node-scene-context",
      sql: `
        ALTER TABLE node_context
        ADD COLUMN present_characters_mode TEXT NOT NULL DEFAULT 'continue'
        CHECK (present_characters_mode IN ('set', 'continue', 'clear'));

        ALTER TABLE node_context
        ADD COLUMN present_character_ids_json TEXT NOT NULL DEFAULT '[]';

        ALTER TABLE node_context
        ADD COLUMN conversation_mode TEXT NOT NULL DEFAULT 'continue'
        CHECK (conversation_mode IN ('set', 'continue', 'clear'));

        ALTER TABLE node_context
        ADD COLUMN conversation_character_ids_json TEXT NOT NULL DEFAULT '[]';

        UPDATE project_meta SET schema_version = 37 WHERE id = 1;
      `,
    },
    {
      id: 38,
      name: "narrative-node-entry-effects",
      sql: `
        ALTER TABLE node_details
        ADD COLUMN entry_effects_json TEXT NOT NULL DEFAULT '[]';

        UPDATE project_meta SET schema_version = 38 WHERE id = 1;
      `,
    },
    {
      id: 39,
      name: "narrative-lightweight-node-conversation",
      sql: `
        ALTER TABLE node_details
        ADD COLUMN dialogue_text TEXT NOT NULL DEFAULT '';

        ALTER TABLE node_details
        ADD COLUMN dialogue_performance_json TEXT NOT NULL DEFAULT '{"charactersPerSecond":18,"cues":[]}';

        UPDATE node_details
        SET dialogue_text = COALESCE((SELECT n.text FROM nodes n WHERE n.id = node_details.node_id), ''),
            dialogue_performance_json = performance_json
        WHERE node_id IN (
          SELECT node_id FROM node_context WHERE character_id IS NOT NULL
        );

        UPDATE nodes
        SET text = ''
        WHERE id IN (
          SELECT node_id FROM node_context WHERE character_id IS NOT NULL
        );

        CREATE TABLE node_context_lightweight (
          node_id TEXT PRIMARY KEY,
          location_id TEXT,
          location_mode TEXT NOT NULL DEFAULT 'continue'
            CHECK (location_mode IN ('set', 'continue', 'clear')),
          conversation_mode TEXT NOT NULL DEFAULT 'continue'
            CHECK (conversation_mode IN ('set', 'continue', 'clear')),
          conversation_character_id TEXT,
          FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
          FOREIGN KEY (location_id) REFERENCES entity_definitions(id),
          FOREIGN KEY (conversation_character_id) REFERENCES entity_definitions(id)
        );

        INSERT INTO node_context_lightweight
          (node_id, location_id, location_mode, conversation_mode, conversation_character_id)
        SELECT
          node_id,
          CASE WHEN location_mode = 'set' THEN location_id ELSE NULL END,
          location_mode,
          CASE
            WHEN character_id IS NOT NULL THEN 'set'
            WHEN conversation_mode = 'set' AND json_array_length(conversation_character_ids_json) > 0 THEN 'set'
            WHEN conversation_mode = 'clear' THEN 'clear'
            ELSE 'continue'
          END,
          CASE
            WHEN character_id IS NOT NULL THEN character_id
            WHEN conversation_mode = 'set' THEN json_extract(conversation_character_ids_json, '$[0]')
            ELSE NULL
          END
        FROM node_context;

        DROP TABLE node_context;
        ALTER TABLE node_context_lightweight RENAME TO node_context;

        UPDATE project_meta SET schema_version = 39 WHERE id = 1;
      `,
    },
    {
      id: 40,
      name: "narrative-interaction-conversation-prose",
      sql: `
        ALTER TABLE interaction_outcomes
        ADD COLUMN response_dialogue_text TEXT NOT NULL DEFAULT '';

        ALTER TABLE interaction_outcomes
        ADD COLUMN response_dialogue_performance_json TEXT NOT NULL DEFAULT '{"charactersPerSecond":18,"cues":[]}';

        UPDATE interaction_outcomes
        SET response_dialogue_text = response_text,
            response_dialogue_performance_json = response_performance_json,
            response_text = '',
            response_characters_per_second = 18,
            response_performance_json = '{"charactersPerSecond":18,"cues":[]}'
        WHERE response_speaker_id IS NOT NULL;

        UPDATE project_meta SET schema_version = 40 WHERE id = 1;
      `,
    },
    {
      id: 43,
      name: "narrative-durable-interaction-order",
      sql: `
        ALTER TABLE interactions
        ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;

        UPDATE interactions
        SET order_index = (
          SELECT COUNT(*)
          FROM interactions AS earlier
          WHERE earlier.source_node_id = interactions.source_node_id
            AND (
              COALESCE(earlier.created_at, '') < COALESCE(interactions.created_at, '')
              OR (
                COALESCE(earlier.created_at, '') = COALESCE(interactions.created_at, '')
                AND earlier.id < interactions.id
              )
            )
        );

        CREATE INDEX IF NOT EXISTS interactions_source_order
        ON interactions(source_node_id, order_index, id);

        UPDATE project_meta SET schema_version = 43 WHERE id = 1;
      `,
    },
    {
      id: 45,
      name: "narrative-node-entry-openings",
      sql: `
        ALTER TABLE nodes ADD COLUMN author_label TEXT NOT NULL DEFAULT '';

        CREATE TABLE node_openings (
          id TEXT PRIMARY KEY,
          node_id TEXT NOT NULL,
          order_index INTEGER NOT NULL DEFAULT 0,
          condition_json TEXT NOT NULL DEFAULT '{"type":"always"}',
          narration_text TEXT NOT NULL DEFAULT '',
          dialogue_text TEXT NOT NULL DEFAULT '',
          narration_performance_json TEXT NOT NULL DEFAULT '{"charactersPerSecond":18,"cues":[]}',
          dialogue_performance_json TEXT NOT NULL DEFAULT '{"charactersPerSecond":18,"cues":[]}',
          FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
        );

        INSERT INTO node_openings (
          id, node_id, order_index, condition_json, narration_text, dialogue_text,
          narration_performance_json, dialogue_performance_json
        )
        SELECT
          'node-opening:' || n.id || ':default',
          n.id,
          0,
          '{"type":"always"}',
          n.text,
          COALESCE(d.dialogue_text, ''),
          COALESCE(d.performance_json, json_object('charactersPerSecond', n.characters_per_second, 'cues', json('[]'))),
          COALESCE(d.dialogue_performance_json, '{"charactersPerSecond":18,"cues":[]}')
        FROM nodes n
        LEFT JOIN node_details d ON d.node_id = n.id;

        CREATE INDEX node_openings_node_order ON node_openings(node_id, order_index, id);

        ALTER TABLE interaction_outcomes
        ADD COLUMN destination_opening_id TEXT REFERENCES node_openings(id);

        ALTER TABLE nodes DROP COLUMN text;
        ALTER TABLE nodes DROP COLUMN characters_per_second;
        ALTER TABLE node_details DROP COLUMN performance_json;
        ALTER TABLE node_details DROP COLUMN dialogue_text;
        ALTER TABLE node_details DROP COLUMN dialogue_performance_json;

        UPDATE project_meta SET schema_version = 45 WHERE id = 1;
      `,
    },
    {
      id: 46,
      name: "narrative-response-input-capture",
      sql: `
        ALTER TABLE interaction_outcomes
        ADD COLUMN input_capture_json TEXT;

        UPDATE project_meta SET schema_version = 46 WHERE id = 1;
      `,
    },
  ],

  async load(db) {
    const [meta, nodes, openings, interactions, choiceVisibilityConditions, aliases, outcomes] = await Promise.all([
      db.prepare("SELECT start_node_id FROM project_meta WHERE id = 1").first<{ start_node_id: string }>(),
      db.prepare(
        `SELECT n.id, n.node_number, n.author_label,
                d.ending, d.tags_json, d.entry_effects_json, d.anchor_mode, d.anchor_text,
                c.location_id, c.location_mode, c.conversation_mode, c.conversation_character_id
           FROM nodes n
           LEFT JOIN node_details d ON d.node_id = n.id
           LEFT JOIN node_context c ON c.node_id = n.id
          ORDER BY n.node_number`,
      ).all<NodeRow>(),
      db.prepare(
        `SELECT id, node_id, order_index, condition_json, narration_text, dialogue_text,
                narration_performance_json, dialogue_performance_json
           FROM node_openings ORDER BY node_id, order_index, id`,
      ).all<OpeningRow>(),
      db.prepare("SELECT id, source_node_id, order_index, wording, match_mode, capture_input, choice_visibility, tags_json, notes FROM interactions ORDER BY source_node_id, order_index, id")
        .all<InteractionRow>(),
      db.prepare("SELECT interaction_id, condition_json FROM interaction_choice_visibility_conditions")
        .all<InteractionChoiceVisibilityRow>(),
      db.prepare("SELECT interaction_id, alias, order_index FROM interaction_aliases ORDER BY order_index, alias")
        .all<AliasRow>(),
      db.prepare(
        `SELECT id, interaction_id, order_index, label, author_status, condition_json, response_text, response_dialogue_text, response_speaker_id,
                response_characters_per_second, response_performance_json, response_dialogue_performance_json, effects_json, input_capture_json, disposition,
                destination_node_id, destination_opening_id
           FROM interaction_outcomes ORDER BY interaction_id, order_index, id`,
      ).all<OutcomeRow>(),
    ]);

    if (!meta) throw new Error("Project has not been initialized.");
    const openingGroups = groupRows(openings.results, (row) => row.node_id);
    const choiceVisibilityByInteraction = new Map(
      choiceVisibilityConditions.results.map((row) => [row.interaction_id, row.condition_json]),
    );
    const aliasGroups = groupRows(aliases.results, (row) => row.interaction_id);
    const outcomeGroups = groupRows(outcomes.results, (row) => row.interaction_id);

    return {
      startNodeId: meta.start_node_id,
      nodes: nodes.results.map((row): GameNode => {
        const locationMode = row.location_mode ?? (row.location_id ? "set" : "continue");
        const conversationMode = row.conversation_mode ?? "continue";
        return {
          id: row.id,
          nodeNumber: row.node_number,
          authorLabel: row.author_label ?? "",
          openings: (openingGroups.get(row.id) ?? []).map((opening): NodeOpening => ({
            id: opening.id,
            order: opening.order_index,
            condition: parseJson(opening.condition_json, { type: "always" }),
            narrationText: opening.narration_text,
            dialogueText: opening.dialogue_text,
            narrationPerformance: migrateLegacyMediaCues(parseJson(opening.narration_performance_json, DEFAULT_TEXT_PERFORMANCE)),
            dialoguePerformance: migrateLegacyMediaCues(parseJson(opening.dialogue_performance_json, DEFAULT_TEXT_PERFORMANCE)),
          })),
          ending: Boolean(row.ending),
          tags: parseJson(row.tags_json, []),
          locationId: locationMode === "set" ? row.location_id : null,
          locationMode,
          conversationMode,
          conversationCharacterId: conversationMode === "set" ? row.conversation_character_id : null,
          anchor: { mode: row.anchor_mode ?? "continue", text: row.anchor_text ?? "" },
          entryEffects: migrateLegacyMediaEffects(parseJson(row.entry_effects_json, [])) as GameNode["entryEffects"],
        };
      }),
      interactions: interactions.results.map((row): Interaction => ({
        id: row.id,
        sourceNodeId: row.source_node_id,
        order: row.order_index,
        wording: row.wording,
        matchMode: row.capture_input ? "capture" : row.match_mode ?? "command",
        choiceVisibility: row.choice_visibility,
        choiceVisibleWhen: parseJson(choiceVisibilityByInteraction.get(row.id), { type: "always" }),
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
          dialogueText: outcome.response_dialogue_text ?? "",
          speakerId: outcome.response_speaker_id,
          responsePerformance: migrateLegacyMediaCues(parseJson(outcome.response_performance_json, {
            charactersPerSecond: outcome.response_characters_per_second,
            cues: [],
          })),
          dialoguePerformance: migrateLegacyMediaCues(parseJson(outcome.response_dialogue_performance_json, DEFAULT_TEXT_PERFORMANCE)),
          effects: migrateLegacyMediaEffects(parseJson(outcome.effects_json, [])) as Interaction["outcomes"][number]["effects"],
          inputCapture: parseInputCapture(outcome.input_capture_json),
          disposition: outcome.disposition,
          destination: outcome.destination_node_id
            ? { nodeId: outcome.destination_node_id, openingId: outcome.destination_opening_id }
            : null,
        })),
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type === "node.upsert") {
      const node = normalizeNodeForPersistence(operation.node);
      const anchor = node.anchor ?? { mode: "continue" as const, text: "" };
      const locationMode = nodeLocationMode(node);
      const conversationMode = nodeConversationMode(node);
      const openingIds = node.openings.map((opening) => opening.id);
      const deleteRemovedOpenings = openingIds.length
        ? db.prepare(`DELETE FROM node_openings WHERE node_id = ? AND id NOT IN (${openingIds.map(() => "?").join(", ")})`).bind(node.id, ...openingIds)
        : db.prepare("DELETE FROM node_openings WHERE node_id = ?").bind(node.id);
      return [
        db.prepare(
          `INSERT INTO nodes (id, node_number, author_label, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET node_number=excluded.node_number, author_label=excluded.author_label,
             updated_at=CURRENT_TIMESTAMP`,
        ).bind(node.id, node.nodeNumber, node.authorLabel),
        db.prepare(
          `INSERT INTO node_details (node_id, ending, tags_json, entry_effects_json, anchor_mode, anchor_text)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(node_id) DO UPDATE SET ending=excluded.ending, tags_json=excluded.tags_json,
             entry_effects_json=excluded.entry_effects_json, anchor_mode=excluded.anchor_mode,
             anchor_text=excluded.anchor_text`,
        ).bind(
          node.id,
          Number(node.ending),
          JSON.stringify(node.tags),
          JSON.stringify(node.entryEffects ?? []),
          anchor.mode,
          anchor.text,
        ),
        db.prepare(
          `INSERT INTO node_context
             (node_id, location_id, location_mode, conversation_mode, conversation_character_id)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(node_id) DO UPDATE SET location_id=excluded.location_id,
             location_mode=excluded.location_mode, conversation_mode=excluded.conversation_mode,
             conversation_character_id=excluded.conversation_character_id`,
        ).bind(
          node.id,
          node.locationId,
          locationMode,
          conversationMode,
          nodeConversationCharacterId(node),
        ),
        ...node.openings.map((opening) => db.prepare(
          `INSERT INTO node_openings
             (id, node_id, order_index, condition_json, narration_text, dialogue_text,
              narration_performance_json, dialogue_performance_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET node_id=excluded.node_id, order_index=excluded.order_index,
             condition_json=excluded.condition_json, narration_text=excluded.narration_text,
             dialogue_text=excluded.dialogue_text, narration_performance_json=excluded.narration_performance_json,
             dialogue_performance_json=excluded.dialogue_performance_json`,
        ).bind(
          opening.id,
          node.id,
          opening.order,
          JSON.stringify(opening.condition),
          opening.narrationText,
          opening.dialogueText,
          JSON.stringify(opening.narrationPerformance),
          JSON.stringify(opening.dialoguePerformance),
        )),
        deleteRemovedOpenings,
      ];
    }

    if (operation.type === "interaction.upsert") {
      const value = operation.interaction;
      const captureInput = value.matchMode === "capture";
      return [
        db.prepare(
          `INSERT INTO interactions
             (id, source_node_id, order_index, wording, match_mode, capture_input, choice_visibility, tags_json, notes, updated_at)
           VALUES (
             ?, ?,
             COALESCE((SELECT MAX(order_index) + 1 FROM interactions WHERE source_node_id = ? AND match_mode <> 'fallback'), 0),
             ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
           )
           ON CONFLICT(id) DO UPDATE SET source_node_id=excluded.source_node_id, wording=excluded.wording,
             match_mode=excluded.match_mode, capture_input=excluded.capture_input, choice_visibility=excluded.choice_visibility,
             tags_json=excluded.tags_json, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          value.id,
          value.sourceNodeId,
          value.sourceNodeId,
          value.wording,
          captureInput ? "command" : value.matchMode ?? "command",
          Number(captureInput),
          value.choiceVisibility ?? "prompt",
          JSON.stringify(value.tags),
          value.notes,
        ),
        db.prepare(
          `INSERT INTO interaction_choice_visibility_conditions (interaction_id, condition_json)
           VALUES (?, ?)
           ON CONFLICT(interaction_id) DO UPDATE SET condition_json=excluded.condition_json`,
        ).bind(value.id, JSON.stringify(value.choiceVisibleWhen ?? { type: "always" })),
        db.prepare("DELETE FROM interaction_aliases WHERE interaction_id = ?").bind(value.id),
        db.prepare("DELETE FROM interaction_outcomes WHERE interaction_id = ?").bind(value.id),
        ...value.aliases.map((alias, index) => db.prepare("INSERT INTO interaction_aliases (interaction_id, alias, order_index) VALUES (?, ?, ?)").bind(value.id, alias, index)),
        ...value.outcomes.map((rawOutcome) => {
          const outcome = normalizeInteractionOutcomeProse(rawOutcome);
          const performance = outcome.responsePerformance ?? DEFAULT_TEXT_PERFORMANCE;
          const dialoguePerformance = outcome.dialoguePerformance ?? DEFAULT_TEXT_PERFORMANCE;
          return db.prepare(
            `INSERT INTO interaction_outcomes
             (id, interaction_id, order_index, label, condition_json, response_text, response_dialogue_text, response_speaker_id,
              response_characters_per_second, response_performance_json, response_dialogue_performance_json, effects_json, input_capture_json,
              disposition, destination_node_id, destination_opening_id, author_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            outcome.id,
            value.id,
            outcome.order,
            outcome.label,
            JSON.stringify(outcome.condition),
            outcome.responseText,
            outcome.dialogueText ?? "",
            outcome.speakerId ?? null,
            performance.charactersPerSecond,
            JSON.stringify(performance),
            JSON.stringify(dialoguePerformance),
            JSON.stringify(outcome.effects),
            outcome.inputCapture ? JSON.stringify(outcome.inputCapture) : null,
            outcome.disposition,
            outcome.destination?.nodeId ?? null,
            outcome.destination?.openingId ?? null,
            outcome.authorStatus ?? "configured",
          );
        }),
      ];
    }

    if (operation.type === "interaction.reorder") {
      return operation.interactionIds.map((interactionId, order) => db.prepare(
        `UPDATE interactions
         SET order_index = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND source_node_id = ? AND match_mode <> 'fallback'`,
      ).bind(order, interactionId, operation.sourceNodeId));
    }

    if (operation.type === "interaction.delete") {
      return [db.prepare("DELETE FROM interactions WHERE id = ?").bind(operation.id)];
    }

    return null;
  },

  resetStatements(db) {
    return [
      db.prepare("DELETE FROM interaction_aliases"),
      db.prepare("DELETE FROM interaction_outcomes"),
      db.prepare("DELETE FROM interaction_choice_visibility_conditions"),
      db.prepare("DELETE FROM interactions"),
      db.prepare("DELETE FROM node_openings"),
      db.prepare("DELETE FROM node_context"),
      db.prepare("DELETE FROM node_details"),
      db.prepare("DELETE FROM nodes WHERE id <> (SELECT start_node_id FROM project_meta WHERE id = 1)"),
    ];
  },

  restoreOperations(snapshot) {
    return [
      ...snapshot.nodes.map((node) => ({ type: "node.upsert" as const, node })),
      ...snapshot.interactions.map((interaction) => ({ type: "interaction.upsert" as const, interaction })),
    ];
  },
};
