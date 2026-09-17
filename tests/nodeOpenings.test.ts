import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createEmptyPlayState, reconcilePlayState } from "../src/engine/project/playState";
import { evaluateCondition } from "../src/engine/rules/conditions";
import type { GameNode, NodeOpening } from "../src/features/narrative/model";
import { resolveNodeOpening } from "../src/features/narrative/nodeOpenings";
import { executeInteraction } from "../src/features/narrative/runtime";
import {
  resolveNarrativeContinuation,
  resolveNodeOpeningPresentation,
} from "../src/features/narrative/runtime/presentation";
import { transitionState } from "../src/features/narrative/effectRuntime";
import { MIGRATION_SCRIPTS, splitSqlStatements } from "../worker/db/migrations";
import { WORKER_FEATURE_PERSISTENCE } from "../worker/features/catalog";
import { narrativeReferenceIssues } from "../worker/features/narrativeIntegrity";
import { interaction, node, project } from "./fixtures";

const PERFORMANCE = { charactersPerSecond: 18, cues: [] };

function opening(
  id: string,
  order: number,
  condition: NodeOpening["condition"],
  narrationText: string,
  dialogueText = "",
): NodeOpening {
  return {
    id,
    order,
    condition,
    narrationText,
    dialogueText,
    narrationPerformance: { ...PERFORMANCE, cues: [] },
    dialoguePerformance: { ...PERFORMANCE, cues: [] },
    after: [],
  };
}

function withOpenings(base: GameNode, openings: NodeOpening[]): GameNode {
  return { ...base, openings };
}

function currentMigrations() {
  return [
    ...MIGRATION_SCRIPTS,
    ...WORKER_FEATURE_PERSISTENCE.flatMap((feature) => feature.migrations ?? []),
  ].sort((left, right) => left.id - right.id);
}

function applyMigration(database: DatabaseSync, sql: string) {
  for (const statement of splitSqlStatements(sql)) database.exec(statement);
}

describe("Node entry responses", () => {
  it("selects first-entry and later-entry prose from traversal occurrence without a second visit counter", () => {
    const question = withOpenings(node("question", 1), [
      opening("question-first", 0, { type: "attempt", operator: "eq", value: 1 }, "Do you have a question?"),
      opening("question-again", 1, { type: "attempt", operator: "gte", value: 2 }, "Anything else?"),
    ]);
    const elsewhere = node("elsewhere", 2);
    const snapshot = project({ startNodeId: question.id, nodes: [question, elsewhere] });
    const firstEntry = createEmptyPlayState(snapshot);

    expect(resolveNodeOpening(snapshot, firstEntry, question)?.id).toBe("question-first");
    expect(resolveNodeOpeningPresentation(snapshot, firstEntry, question).text).toBe("Do you have a question?");

    const returned = {
      ...firstEntry,
      currentNodeId: question.id,
      currentNodeOpeningId: null,
      traversal: [question.id, elsewhere.id, question.id],
    };
    expect(resolveNodeOpening(snapshot, returned, question)?.id).toBe("question-again");
    expect(resolveNodeOpeningPresentation(snapshot, returned, question).text).toBe("Anything else?");
  });

  it("keeps an explicitly named attempt event authoritative inside a local occurrence context", () => {
    const snapshot = project();
    const state = {
      ...createEmptyPlayState(snapshot),
      attempts: { "interaction:remembered": 5 },
    };

    expect(evaluateCondition(
      { type: "attempt", eventKey: "interaction:remembered", operator: "eq", value: 5 },
      { snapshot, state, occurrence: 1 },
    )).toBe(true);
    expect(evaluateCondition(
      { type: "attempt", eventKey: "interaction:remembered", operator: "eq", value: 1 },
      { snapshot, state, occurrence: 1 },
    )).toBe(false);
  });

  it("lets AUTO re-evaluate conditions on every real entry while a specific link forces its stable opening", () => {
    const start = node("start", 1);
    const question = withOpenings(node("question", 2), [
      opening("question-first", 0, { type: "attempt", operator: "eq", value: 1 }, "First visit."),
      opening("question-return", 1, { type: "attempt", operator: "gte", value: 2 }, "Return visit."),
      opening("question-forced", 2, { type: "attempt", operator: "eq", value: 999 }, "Forced visit."),
    ]);
    const auto = interaction("auto", start.id, question.id, ["auto"]);
    const forced = interaction("forced", start.id, question.id, ["forced"]);
    forced.outcomes[0] = {
      ...forced.outcomes[0],
      after: [{
        id: "forced-transition",
        type: "transition",
        destination: { nodeId: question.id, openingId: "question-forced" },
      }],
    };
    const snapshot = project({
      startNodeId: start.id,
      nodes: [start, question],
      interactions: [auto, forced],
    });
    const initial = createEmptyPlayState(snapshot);

    const first = executeInteraction(snapshot, initial, auto);
    expect(first.state.currentNodeOpeningId).toBeNull();
    expect(resolveNodeOpeningPresentation(snapshot, first.state, question).text).toBe("First visit.");

    const backAtStart = transitionState(first.state, { nodeId: start.id, openingId: null });
    const second = executeInteraction(snapshot, backAtStart, auto);
    expect(resolveNodeOpeningPresentation(snapshot, second.state, question).text).toBe("Return visit.");

    const forcedFromStart = executeInteraction(
      snapshot,
      transitionState(second.state, { nodeId: start.id, openingId: null }),
      forced,
    );
    expect(forcedFromStart.state.currentNodeOpeningId).toBe("question-forced");
    const presentation = resolveNodeOpeningPresentation(snapshot, forcedFromStart.state, question);
    expect(presentation.text).toBe("Forced visit.");
    expect(presentation.source.focus?.openingId).toBe("question-forced");
  });

  it("keeps narration and follow-up dialogue bound to the same selected opening", () => {
    const guide = {
      id: "guide",
      key: "guide",
      type: "character" as const,
      name: "Guide",
      description: "",
      tags: [],
    };
    const question = withOpenings({
      ...node("question", 1),
      conversationMode: "set",
      conversationCharacterId: guide.id,
    }, [
      opening("question-first", 0, { type: "always" }, "You return.", "Anything else?"),
    ]);
    const snapshot = project({ startNodeId: question.id, nodes: [question], entities: [guide] });
    const state = createEmptyPlayState(snapshot);
    const narration = resolveNodeOpeningPresentation(snapshot, state, question);
    const continuation = resolveNarrativeContinuation(snapshot, state, question.id, narration.source);

    expect(narration.source.focus).toEqual({ openingId: "question-first", section: "narration" });
    expect(continuation.nodeOpening?.id).toBe("question-first");
    expect(continuation.nodeDialoguePending).toBe(true);
    expect(continuation.nodeDialogue?.text).toBe("Anything else?");
    expect(continuation.nodeDialogue?.speakerId).toBe(guide.id);
    expect(continuation.nodeDialogue?.source.focus).toEqual({ openingId: "question-first", section: "dialogue" });
  });

  it("drops a stale specific-opening run override during play-state reconciliation", () => {
    const current = withOpenings(node("question", 1), [opening("kept", 0, { type: "always" }, "Kept")]);
    const snapshot = project({ startNodeId: current.id, nodes: [current] });
    const state = {
      ...createEmptyPlayState(snapshot),
      currentNodeOpeningId: "removed-opening",
    };

    expect(reconcilePlayState(snapshot, state).currentNodeOpeningId).toBeNull();
  });

  it("reports cross-Node opening targets and duplicate opening ownership as graph integrity damage", () => {
    const left = withOpenings(node("left", 1), [
      opening("left-only", 0, { type: "always" }, "Left"),
      opening("duplicate-opening", 1, { type: "always" }, "Left duplicate"),
    ]);
    const right = withOpenings(node("right", 2), [
      opening("right-opening", 0, { type: "always" }, "Right"),
      opening("duplicate-opening", 1, { type: "always" }, "Right duplicate"),
    ]);
    const link = interaction("go", left.id, right.id, ["go"]);
    link.outcomes[0] = {
      ...link.outcomes[0],
      after: [{
        id: "bad-transition",
        type: "transition",
        destination: { nodeId: right.id, openingId: "left-only" },
      }],
    };
    const snapshot = project({ startNodeId: left.id, nodes: [left, right], interactions: [link] });
    const messages = narrativeReferenceIssues(snapshot).map((issue) => issue.message);

    expect(messages).toContain("Node entry response identities must be unique across the project.");
    expect(messages).toContain("A response targets an entry response that is not owned by its destination Node. Choose AUTO or an opening from that Node.");
  });

  it("migrates D1 Node prose once into entry responses and removes obsolete storage columns", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();
    const openingMigration = migrations.find((migration) => migration.id === 45);
    expect(openingMigration).toBeDefined();

    try {
      for (const migration of migrations.filter((migration) => migration.id < 45)) {
        applyMigration(database, migration.sql);
      }

      const start = database.prepare("SELECT start_node_id FROM project_meta WHERE id = 1").get() as { start_node_id: string };
      database.prepare("UPDATE nodes SET text = ?, characters_per_second = ? WHERE id = ?")
        .run("Do you have a question?", 31, start.start_node_id);
      database.prepare(`
        INSERT OR REPLACE INTO node_details
          (node_id, performance_json, dialogue_text, dialogue_performance_json)
        VALUES (?, ?, ?, ?)
      `).run(
        start.start_node_id,
        JSON.stringify({ charactersPerSecond: 31, cues: [] }),
        "Ask away.",
        JSON.stringify({ charactersPerSecond: 17, cues: [] }),
      );
      database.prepare("INSERT INTO interactions (id, source_node_id, wording) VALUES ('legacy-link', ?, 'again')")
        .run(start.start_node_id);
      database.prepare(`
        INSERT INTO interaction_outcomes
          (id, interaction_id, response_text, response_speaker_id, response_characters_per_second,
           response_performance_json, disposition, destination_node_id)
        VALUES ('legacy-link-default', 'legacy-link', '', NULL, 18,
          '{"charactersPerSecond":18,"cues":[]}', 'transition', ?)
      `).run(start.start_node_id);

      applyMigration(database, openingMigration!.sql);

      const migrated = database.prepare(`
        SELECT id, node_id, order_index, condition_json, narration_text, dialogue_text,
               narration_performance_json, dialogue_performance_json
        FROM node_openings WHERE node_id = ?
      `).get(start.start_node_id) as {
        id: string;
        node_id: string;
        order_index: number;
        condition_json: string;
        narration_text: string;
        dialogue_text: string;
        narration_performance_json: string;
        dialogue_performance_json: string;
      };
      const outcome = database.prepare(`
        SELECT destination_node_id, destination_opening_id
        FROM interaction_outcomes WHERE id = 'legacy-link-default'
      `).get() as { destination_node_id: string; destination_opening_id: string | null };
      const nodeColumns = database.prepare("PRAGMA table_info(nodes)").all() as unknown as Array<{ name: string }>;
      const detailColumns = database.prepare("PRAGMA table_info(node_details)").all() as unknown as Array<{ name: string }>;
      const meta = database.prepare("SELECT schema_version FROM project_meta WHERE id = 1").get() as { schema_version: number };

      expect(migrated).toMatchObject({
        id: `node-opening:${start.start_node_id}:default`,
        node_id: start.start_node_id,
        order_index: 0,
        narration_text: "Do you have a question?",
        dialogue_text: "Ask away.",
      });
      expect(JSON.parse(migrated.condition_json)).toEqual({ type: "always" });
      expect(JSON.parse(migrated.narration_performance_json)).toEqual({ charactersPerSecond: 31, cues: [] });
      expect(JSON.parse(migrated.dialogue_performance_json)).toEqual({ charactersPerSecond: 17, cues: [] });
      expect(outcome).toEqual({ destination_node_id: start.start_node_id, destination_opening_id: null });
      expect(nodeColumns.map((column) => column.name)).not.toContain("text");
      expect(nodeColumns.map((column) => column.name)).not.toContain("characters_per_second");
      expect(detailColumns.map((column) => column.name)).not.toContain("performance_json");
      expect(detailColumns.map((column) => column.name)).not.toContain("dialogue_text");
      expect(detailColumns.map((column) => column.name)).not.toContain("dialogue_performance_json");
      expect(meta.schema_version).toBe(45);
    } finally {
      database.close();
    }
  });
});
