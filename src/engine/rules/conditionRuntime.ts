import type { Condition, ComparisonOperator, Value } from "./model";
import type { PlayState, ProjectSnapshot } from "../project/model";

export type ConditionContext = {
  snapshot: ProjectSnapshot;
  state: PlayState;
  eventKey?: string;
};

export type ConditionHandler = (condition: Condition, context: ConditionContext) => boolean;
export type ConditionValidator = (condition: Condition) => string[];

export function compareValues(left: Value | undefined, operator: ComparisonOperator, right: Value) {
  switch (operator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
  }
}
