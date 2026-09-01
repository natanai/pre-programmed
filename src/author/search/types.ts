import type { ProjectSnapshot } from "../../engine/project/model";

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
