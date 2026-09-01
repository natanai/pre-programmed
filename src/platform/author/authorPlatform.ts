import type { AuthorBookmark, ProjectSnapshot, RevisionSummary } from "../../engine/project/model";

export type AuthorWorkspaceSnapshot = {
  revisions: RevisionSummary[];
  bookmarks: AuthorBookmark[];
};

export type AuthorBackupDownload = {
  blob: Blob;
  filename: string;
};

/**
 * Platform boundary for Author-session services that are not project
 * persistence itself. Hosted builds can authenticate over HTTP; a local
 * distribution can provide the same capabilities without a cloud account.
 */
export interface AuthorPlatform {
  checkSession(authorization: string): Promise<boolean>;
  login(key: string): Promise<string>;
  downloadBackup(authorization: string): Promise<AuthorBackupDownload>;
  readWorkspace(authorization: string): Promise<AuthorWorkspaceSnapshot>;
  undoLastRevision(authorization: string, expectedRevision: number): Promise<ProjectSnapshot>;
}
