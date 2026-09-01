import type { ProjectSnapshot } from "../../game/model";
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
  list: (snapshot: ProjectSnapshot) => AuthorResourceOption[];
  createRoute?: () => AuthorTaskRoute;
  editRoute?: (resource: AuthorResourceOption) => AuthorTaskRoute;
};

export type AuthorResourceTools = {
  options: (kind: string) => AuthorResourceOption[];
  label: (kind: string) => string;
  canCreate: (kind: string) => boolean;
  canEdit: (kind: string, value: string) => boolean;
  create: (kind: string, onCreated: (resource: AuthorResourceResult) => void) => void;
  edit: (kind: string, value: string, onComplete?: AuthorTaskCompletion) => void;
};
