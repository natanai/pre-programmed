import type { ProjectSnapshot } from "../../engine/project/model";
import type { AuthorToolContext } from "../tools/types";

/** Search document kinds are feature-extensible identifiers, not a central enum. */
export type SearchKind = string;

export type SearchDocument = {
  id: string;
  kind: SearchKind;
  label: string;
  searchText: string;
  nodeId?: string;
};

export type SearchDocumentContribution = (snapshot: ProjectSnapshot) => readonly SearchDocument[];

/** One actionable destination in the Author-wide navigation search. */
export type AuthorSearchEntry = {
  id: string;
  groupLabel: string;
  label: string;
  description: string;
  searchText: string;
  tone?: "normal" | "draft";
  onSelect: () => void;
};

/** Feature-owned vocabulary and destinations for Author navigation. */
export type AuthorSearchContributor = (context: AuthorToolContext) => readonly AuthorSearchEntry[];
