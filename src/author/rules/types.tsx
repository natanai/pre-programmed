import type { ReactNode } from "react";
import type { Condition, Effect, ProjectSnapshot } from "../../game/model";

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
  create: () => Effect;
  summarize?: (effect: Effect, snapshot: ProjectSnapshot) => string;
  render: (context: EffectAuthorContext) => ReactNode;
};
