import type { ProjectSnapshot } from "../../engine/project/model";
import type { Condition, Effect } from "../../engine/rules/model";
import type { TextPerformance } from "../../features/narrative/model";
import type { AuthorTaskRoute } from "../tasks/types";

export type ResourceReference = {
  resourceKind: string;
  resourceId: string;
  detail: string;
};

export type ProjectReference = {
  resourceKind: string;
  resourceId: string;
  ownerKind: string;
  ownerId: string;
  ownerLabel: string;
  detail: string;
  route?: AuthorTaskRoute;
};

export type ProjectReferenceContext = {
  condition: (condition: Condition) => readonly ResourceReference[];
  effects: (effects: readonly Effect[]) => readonly ResourceReference[];
  performance: (performance: TextPerformance) => readonly ResourceReference[];
};

export type ProjectReferenceContribution = (
  snapshot: ProjectSnapshot,
  context: ProjectReferenceContext,
) => readonly ProjectReference[];
