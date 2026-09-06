import type { ProjectSnapshot } from "../../engine/project/model";
import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";
import {
  OPERATION_TARGET_ID_BINDING,
  OPERATION_TARGET_KIND_BINDING,
  type RuleRuntimeContext,
} from "../../engine/rules/runtimeBindings";
import { WORLD_ENTITY_OPERATION_TARGET_KIND } from "./operationAdapter";

function operationTargetEntity(snapshot: ProjectSnapshot, context: RuleRuntimeContext) {
  if (context.bindings?.[OPERATION_TARGET_KIND_BINDING] !== WORLD_ENTITY_OPERATION_TARGET_KIND) return null;
  const id = context.bindings?.[OPERATION_TARGET_ID_BINDING];
  if (typeof id !== "string") return null;
  return snapshot.entities.find((entity) => entity.id === id) ?? null;
}

const targetDescription: EffectHandler = (effect, snapshot, state, context) => {
  if (effect.type !== "world_target_description") return unchangedEffect(state);
  const entity = operationTargetEntity(snapshot, context);
  const text = entity?.description?.trim();
  return text ? { state, events: [{ type: "transcript", text }] } : unchangedEffect(state);
};

const targetPortrait: EffectHandler = (effect, snapshot, state, context) => {
  if (effect.type !== "world_target_portrait") return unchangedEffect(state);
  const entity = operationTargetEntity(snapshot, context);
  const assetId = entity?.type === "character" ? entity.portraitAssetId?.trim() : "";
  return assetId ? { state, events: [{ type: "world_portrait", assetId }] } : unchangedEffect(state);
};

export const WORLD_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  world_target_description: targetDescription,
  world_target_portrait: targetPortrait,
};
