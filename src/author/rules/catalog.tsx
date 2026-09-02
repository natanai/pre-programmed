import type { Condition, Effect } from "../../engine/rules/model";
import { getAuthorConditionAdapters, getAuthorEffectAdapters } from "../features/registry";
import type { EffectAuthorAdapter } from "./types";

export function conditionAuthorAdapters() {
  return getAuthorConditionAdapters();
}

export function effectAuthorAdapters() {
  return getAuthorEffectAdapters();
}

export function conditionAuthorAdapter(type: Condition["type"]) {
  return conditionAuthorAdapters().find((adapter) => adapter.type === type);
}

export function effectAuthorAdapter(type: Effect["type"]) {
  return effectAuthorAdapters().find((adapter) => adapter.type === type);
}

export function previewEventsForEffects(
  effects: Parameters<NonNullable<EffectAuthorAdapter["previewEvents"]>>[0][],
  snapshot: Parameters<NonNullable<EffectAuthorAdapter["previewEvents"]>>[1],
) {
  return effects.flatMap((effect) => effectAuthorAdapter(effect.type)?.previewEvents?.(effect, snapshot) ?? []);
}
