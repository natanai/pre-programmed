import type { ReactNode } from "react";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import type { Condition, Effect } from "../../engine/rules/model";
import type { ProjectSnapshot } from "../../engine/project/model";
import type { ResourceReference } from "../references/types";

export type RenderNestedCondition = (
  condition: Condition,
  onChange: (condition: Condition) => void,
) => ReactNode;

export type ConditionAuthorContext = {
  condition: Condition;
  snapshot: ProjectSnapshot;
  onChange: (condition: Condition) => void;
  depth: number;
  renderNested: RenderNestedCondition;
};

export type ConditionAuthorAdapter = {
  type: Condition["type"];
  label: string;
  create: () => Condition;
  references?: (condition: Condition) => readonly ResourceReference[];
  render: (context: ConditionAuthorContext) => ReactNode;
};

export type EffectAuthorContext = {
  effect: Effect;
  snapshot: ProjectSnapshot;
  onChange: (effect: Effect) => void;
};

export type EffectAuthorAdapter = {
  type: Effect["type"];
  label: string;
  category: string;
  description: string;
  create: () => Effect;
  summarize?: (effect: Effect, snapshot: ProjectSnapshot) => string;
  references?: (effect: Effect) => readonly ResourceReference[];
  /** Safe presentation-only events; state-changing effects deliberately omit this. */
  previewEvents?: (effect: Effect, snapshot: ProjectSnapshot) => EffectEvent[];
  render: (context: EffectAuthorContext) => ReactNode;
};
