import type { AuthorBookmark, ProjectSnapshot, RevisionSummary } from "../../engine/project/model";

export type AuthorWorkspaceSnapshot = {
  revisions: RevisionSummary[];
  bookmarks: AuthorBookmark[];
};

export type AuthorFileDownload = {
  blob: Blob;
  filename: string;
};

/**
 * Platform boundary for Author-session services that are not ordinary project
 * mutation persistence itself. Hosted builds authenticate over HTTP; a local
 * distribution provides the same capabilities against its local Worker.
 * Whole-project import/export crosses this boundary once and then delegates to
 * the canonical Worker feature persistence contracts. Run bookmarks remain
 * installation-local Author state and use their own save/delete methods.
 */
export interface AuthorPlatform {
  checkSession(authorization: string): Promise<boolean>;
  login(key: string): Promise<string>;
  downloadBackup(authorization: string): Promise<AuthorFileDownload>;
  downloadProject(authorization: string): Promise<AuthorFileDownload>;
  importProject(authorization: string, file: Blob): Promise<ProjectSnapshot>;
  readWorkspace(authorization: string): Promise<AuthorWorkspaceSnapshot>;
  saveRunBookmark(authorization: string, bookmark: AuthorBookmark): Promise<AuthorBookmark>;
  deleteRunBookmark(authorization: string, id: string): Promise<void>;
  undoLastRevision(authorization: string, expectedRevision: number): Promise<ProjectSnapshot>;
}
