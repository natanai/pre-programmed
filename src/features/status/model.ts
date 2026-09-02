import type { Condition } from "../../engine/rules/model";

export type StatusSourceReference =
  | { kind: "value"; id: string }
  | { kind: "derived"; id: string };

export type StatusGroupDefinition = {
  id: string;
  key: string;
  label: string;
  order: number;
  visibleWhen: Condition;
};

export type StatusEntryDefinition = {
  id: string;
  groupId: string;
  source: StatusSourceReference;
  label: string;
  order: number;
  visibleWhen: Condition;
};
