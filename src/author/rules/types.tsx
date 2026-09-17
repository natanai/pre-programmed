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

/**
 * Optional hints supplied by the owning authoring context to the canonical
 * Effects editor. Effects remain owned by their feature adapters; consumers
 * may only advertise which runtime value source is most relevant here.
 */
export type EffectAuthoringContext = {
  preferredRuntimeBindingKey?: string;
};

export type EffectAuthorContext = {
  effect: Effect;
  snapshot: ProjectSnapshot;
  onChange: (effect: Effect) => void;
  authoringContext?: EffectAuthoringContext;
};

export type EffectAuthorAdapter = {
  type: Effect["type"];
  label: string;
  category: string;
  description: string;
  /** When present, only offer this effect while editing a compatible operation target. */
  targetKinds?: readonly string[];
  create: (context?: EffectAuthoringContext) => Effect;
  summarize?: (effect: Effect, snapshot: ProjectSnapshot) => string;
  references?: (effect: Effect) => readonly ResourceReference[];
  /** Safe presentation-only events; state-changing effects deliberately omit this. */
  previewEvents?: (effect: Effect, snapshot: ProjectSnapshot) => EffectEvent[];
  render: (context: EffectAuthorContext) => ReactNode;
};
