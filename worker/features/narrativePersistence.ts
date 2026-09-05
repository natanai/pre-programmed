import { nodeLocationMode, normalizeNodeLocationContext } from "../../src/features/narrative/locationContext";
import type { GameNode, Interaction } from "../../src/features/narrative/model";
import { legacyAssetId } from "../../src/features/media/assetReference";
import { parseJson } from "../db/json";
import type { WorkerFeaturePersistence } from "./types";

function groupRows<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
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
  location_mode: "set" | "continue" | "clear" | null;
  anchor_mode: "set" | "continue" | "clear" | null;
  anchor_text: string | null;
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
  response_speaker_id: string | null;
  response_characters_per_second: number;
  response_performance_json: string;
  effects_json: string;
  disposition: "stay" | "transition";
  destination_node_id: string | null;
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
  ],

  async load(db) {
    const [meta, nodes, interactions, choiceVisibilityConditions, aliases, outcomes] = await Promise.all([
      db.prepare("SELECT start_node_id FROM project_meta WHERE id = 1").first<{ start_node_id: string }>(),
      db.prepare(
        `SELECT n.id, n.node_number, n.text, n.characters_per_second,
                d.ending, d.tags_json, d.performance_json, d.anchor_mode, d.anchor_text,
                c.character_id, c.location_id, c.location_mode
           FROM nodes n
           LEFT JOIN node_details d ON d.node_id = n.id
           LEFT JOIN node_context c ON c.node_id = n.id
          ORDER BY n.node_number`,
      ).all<NodeRow>(),
      db.prepare("SELECT id, source_node_id, wording, match_mode, choice_visibility, tags_json, notes FROM interactions ORDER BY created_at, id")
        .all<InteractionRow>(),
      db.prepare("SELECT interaction_id, condition_json FROM interaction_choice_visibility_conditions")
        .all<InteractionChoiceVisibilityRow>(),
      db.prepare("SELECT interaction_id, alias, order_index FROM interaction_aliases ORDER BY order_index, alias")
        .all<AliasRow>(),
      db.prepare(
        `SELECT id, interaction_id, order_index, label, author_status, condition_json, response_text, response_speaker_id,
                response_characters_per_second, response_performance_json, effects_json, disposition, destination_node_id
           FROM interaction_outcomes ORDER BY interaction_id, order_index, id`,
      ).all<OutcomeRow>(),
    ]);

    if (!meta) throw new Error("Project has not been initialized.");
    const choiceVisibilityByInteraction = new Map(
      choiceVisibilityConditions.results.map((row) => [row.interaction_id, row.condition_json]),
    );
    const aliasGroups = groupRows(aliases.results, (row) => row.interaction_id);
    const outcomeGroups = groupRows(outcomes.results, (row) => row.interaction_id);

    return {
      startNodeId: meta.start_node_id,
      nodes: nodes.results.map((row): GameNode => {
        const performance = migrateLegacyMediaCues(parseJson(row.performance_json, {
          charactersPerSecond: row.characters_per_second,
          cues: [],
        }));
        const locationMode = row.location_mode ?? (row.location_id ? "set" : "continue");
        return {
          id: row.id,
          nodeNumber: row.node_number,
          text: row.text,
          ending: Boolean(row.ending),
          tags: parseJson(row.tags_json, []),
          characterId: row.character_id,
          locationId: locationMode === "set" ? row.location_id : null,
          locationMode,
          anchor: {
            mode: row.anchor_mode ?? "continue",
            text: row.anchor_text ?? "",
          },
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
          speakerId: outcome.response_speaker_id,
          responsePerformance: migrateLegacyMediaCues(parseJson(outcome.response_performance_json, {
            charactersPerSecond: outcome.response_characters_per_second,
            cues: [],
          })),
          effects: migrateLegacyMediaEffects(parseJson(outcome.effects_json, [])) as Interaction["outcomes"][number]["effects"],
          disposition: outcome.disposition,
          destinationNodeId: outcome.destination_node_id,
        })),
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type === "node.upsert") {
      const node = normalizeNodeLocationContext(operation.node);
      const anchor = node.anchor ?? { mode: "continue" as const, text: "" };
      const locationMode = nodeLocationMode(node);
      return [
        db.prepare(
          `INSERT INTO nodes (id, node_number, text, characters_per_second, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET node_number=excluded.node_number, text=excluded.text,
             characters_per_second=excluded.characters_per_second, updated_at=CURRENT_TIMESTAMP`,
        ).bind(node.id, node.nodeNumber, node.text, node.performance.charactersPerSecond),
        db.prepare(
          `INSERT INTO node_details (node_id, ending, tags_json, performance_json, anchor_mode, anchor_text)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(node_id) DO UPDATE SET ending=excluded.ending, tags_json=excluded.tags_json,
             performance_json=excluded.performance_json, anchor_mode=excluded.anchor_mode,
             anchor_text=excluded.anchor_text`,
        ).bind(
          node.id,
          Number(node.ending),
          JSON.stringify(node.tags),
          JSON.stringify(node.performance),
          anchor.mode,
          anchor.text,
        ),
        db.prepare(
          `INSERT INTO node_context (node_id, character_id, location_id, location_mode)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(node_id) DO UPDATE SET character_id=excluded.character_id,
             location_id=excluded.location_id, location_mode=excluded.location_mode`,
        ).bind(node.id, node.characterId, node.locationId, locationMode),
      ];
    }

    if (operation.type === "interaction.upsert") {
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
        db.prepare(
          `INSERT INTO interaction_choice_visibility_conditions (interaction_id, condition_json)
           VALUES (?, ?)
           ON CONFLICT(interaction_id) DO UPDATE SET condition_json=excluded.condition_json`,
        ).bind(value.id, JSON.stringify(value.choiceVisibleWhen ?? { type: "always" })),
        db.prepare("DELETE FROM interaction_aliases WHERE interaction_id = ?").bind(value.id),
        db.prepare("DELETE FROM interaction_outcomes WHERE interaction_id = ?").bind(value.id),
        ...value.aliases.map((alias, index) => db.prepare("INSERT INTO interaction_aliases (interaction_id, alias, order_index) VALUES (?, ?, ?)").bind(value.id, alias, index)),
        ...value.outcomes.map((outcome) => {
          const legacyOutcome = outcome as typeof outcome & { responseCharactersPerSecond?: number };
          const performance = outcome.responsePerformance ?? {
            charactersPerSecond: legacyOutcome.responseCharactersPerSecond ?? 18,
            cues: [],
          };
          return db.prepare(
          `INSERT INTO interaction_outcomes
           (id, interaction_id, order_index, label, condition_json, response_text, response_speaker_id,
            response_characters_per_second, response_performance_json, effects_json, disposition, destination_node_id, author_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          outcome.id,
          value.id,
          outcome.order,
          outcome.label,
          JSON.stringify(outcome.condition),
          outcome.responseText,
          outcome.speakerId ?? null,
          performance.charactersPerSecond,
          JSON.stringify(performance),
          JSON.stringify(outcome.effects),
          outcome.disposition,
          outcome.destinationNodeId,
          outcome.authorStatus ?? "configured",
        );
        }),
      ];
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
