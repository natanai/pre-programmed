import type { ProjectSnapshot } from "../../engine/project/model";
import type { AuthorResourceResult, AuthorTaskCompletion, AuthorTaskRoute } from "../tasks/types";

export type AuthorResourceOption = {
  id: string;
  value: string;
  label: string;
  detail?: string;
};

/** Feature-owned description of one kind of project resource that Author UI may reference. */
export type AuthorResourceProvider = {
  kind: string;
  label: string;
  pluralLabel?: string;
  /** False for reference-only aliases that would duplicate a canonical resource in global search. */
  searchable?: boolean;
  list: (snapshot: ProjectSnapshot) => AuthorResourceOption[];
  createRoute?: () => AuthorTaskRoute;
  /** The owner may use the snapshot to dispatch union/reference-only resource kinds to their canonical editor. */
  editRoute?: (resource: AuthorResourceOption, snapshot: ProjectSnapshot) => AuthorTaskRoute | null;
};

export type AuthorResourceTools = {
  options: (kind: string) => AuthorResourceOption[];
  label: (kind: string) => string;
  canCreate: (kind: string) => boolean;
  canEdit: (kind: string, value: string) => boolean;
  create: (kind: string, onCreated: (resource: AuthorResourceResult) => void) => void;
  edit: (kind: string, value: string, onComplete?: AuthorTaskCompletion) => void;
};
