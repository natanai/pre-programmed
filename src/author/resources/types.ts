import type { ReactNode } from "react";
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
  /** Optional owner-rendered preview for a selected resource reference. */
  preview?: (
    resource: AuthorResourceOption,
    snapshot: ProjectSnapshot,
    onEdit?: () => void,
  ) => ReactNode;
  /** Canonical owner-managed collection/list task for this resource kind. */
  listRoute?: () => AuthorTaskRoute;
  createRoute?: () => AuthorTaskRoute;
  /** The owner may use the snapshot to dispatch union/reference-only resource kinds to their canonical editor. */
  editRoute?: (resource: AuthorResourceOption, snapshot: ProjectSnapshot) => AuthorTaskRoute | null;
};

export type AuthorResourceTools = {
  options: (kind: string) => AuthorResourceOption[];
  label: (kind: string) => string;
  preview: (kind: string, value: string) => ReactNode | null;
  canOpenList: (kind: string) => boolean;
  canCreate: (kind: string) => boolean;
  canEdit: (kind: string, value: string) => boolean;
  openList: (kind: string) => void;
  create: (kind: string, onCreated: (resource: AuthorResourceResult) => void) => void;
  /**
   * Enter the owning editor. Optional focus is owner-specific route metadata
   * (for example, an operation or body slot) and never creates a second editor.
   */
  edit: (
    kind: string,
    value: string,
    onComplete?: AuthorTaskCompletion,
    focus?: Readonly<Record<string, string>>,
  ) => void;
};
