import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "./types";
import {
  allConditionAdapter,
  alwaysConditionAdapter,
  anyConditionAdapter,
  attemptConditionAdapter,
  notConditionAdapter,
  notificationEffectAdapter,
  runtimeStateConditionAdapter,
} from "./coreAdapters";
import { hasItemConditionAdapter, lacksItemConditionAdapter, giveItemEffectAdapter, removeItemEffectAdapter, setItemStateEffectAdapter } from "../../features/inventory/author/ruleAdapters";
import { audioEffectAdapter, artEffectAdapter, synthEffectAdapter } from "../../features/media/author/ruleAdapters";
import { interactionVisibilityEffectAdapter, transitionEffectAdapter, visitedConditionAdapter } from "../../features/narrative/author/ruleAdapters";
import {
  clearFlagEffectAdapter,
  decrementEffectAdapter,
  flagConditionAdapter,
  incrementEffectAdapter,
  setFlagEffectAdapter,
  setValueEffectAdapter,
  variableConditionAdapter,
} from "../../features/state/author/ruleAdapters";

export const CONDITION_AUTHOR_ADAPTERS: readonly ConditionAuthorAdapter[] = [
  alwaysConditionAdapter,
  allConditionAdapter,
  anyConditionAdapter,
  notConditionAdapter,
  hasItemConditionAdapter,
  lacksItemConditionAdapter,
  flagConditionAdapter,
  variableConditionAdapter,
  attemptConditionAdapter,
  visitedConditionAdapter,
  runtimeStateConditionAdapter,
];

export const EFFECT_AUTHOR_ADAPTERS: readonly EffectAuthorAdapter[] = [
  setFlagEffectAdapter,
  clearFlagEffectAdapter,
  setValueEffectAdapter,
  incrementEffectAdapter,
  decrementEffectAdapter,
  giveItemEffectAdapter,
  removeItemEffectAdapter,
  setItemStateEffectAdapter,
  interactionVisibilityEffectAdapter,
  notificationEffectAdapter,
  synthEffectAdapter,
  audioEffectAdapter,
  artEffectAdapter,
  transitionEffectAdapter,
];

export const CONDITION_AUTHOR_ADAPTER_BY_TYPE = Object.fromEntries(CONDITION_AUTHOR_ADAPTERS.map((adapter) => [adapter.type, adapter])) as Partial<Record<ConditionAuthorAdapter["type"], ConditionAuthorAdapter>>;
export const EFFECT_AUTHOR_ADAPTER_BY_TYPE = Object.fromEntries(EFFECT_AUTHOR_ADAPTERS.map((adapter) => [adapter.type, adapter])) as Partial<Record<EffectAuthorAdapter["type"], EffectAuthorAdapter>>;
