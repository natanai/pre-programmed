import type { OperationHook, OperationId } from "../../src/features/operations/model";
import { parseJson } from "../db/json";

type HookRow = {
  id: string;
  target_id: string;
  operation: OperationId;
  order_index: number;
  condition_json: string;
  response_text: string;
  effects_json: string;
  success: number;
};

export async function loadHooksForKind(db: D1Database, targetKind: string) {
  const rows = await db.prepare(
    `SELECT id, target_id, operation, order_index, condition_json, response_text, effects_json, success
       FROM operation_hooks WHERE target_kind = ?
      ORDER BY target_id, operation, order_index, id`,
  ).bind(targetKind).all<HookRow>();

  const groups = new Map<string, OperationHook[]>();
  for (const row of rows.results) {
    const hook: OperationHook = {
      id: row.id,
      operation: row.operation,
      order: row.order_index,
      condition: parseJson(row.condition_json, { type: "always" } as const),
      responseText: row.response_text,
      effects: parseJson(row.effects_json, []),
      success: Boolean(row.success),
    };
    groups.set(row.target_id, [...(groups.get(row.target_id) ?? []), hook]);
  }
  return groups;
}

export function hookStatements(
  db: D1Database,
  targetKind: string,
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
      hook.id,
      targetKind,
      targetId,
      hook.operation,
      hook.order,
      JSON.stringify(hook.condition),
      hook.responseText,
      JSON.stringify(hook.effects),
      Number(hook.success),
    )),
  ];
}

export function resetHooksForKind(db: D1Database, targetKind: string) {
  return db.prepare("DELETE FROM operation_hooks WHERE target_kind = ?").bind(targetKind);
}
