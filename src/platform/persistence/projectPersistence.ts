import type { ProjectMutation, ProjectSnapshot } from "../../engine/project/model";

export type ProjectWriteContext = {
  /** Hosted stores may require a credential; local stores can ignore it. */
  authorization?: string;
};

/**
 * Storage-independent optimistic-concurrency failure.
 *
 * Hosted persistence can translate HTTP/database conflicts into this error;
 * future local-file persistence can raise the same error when the project on
 * disk changed after the author loaded it.
 */
export class ProjectRevisionConflictError extends Error {
  constructor(message = "The project changed after this edit began.") {
    super(message);
    this.name = "ProjectRevisionConflictError";
  }
}

/**
 * Storage boundary for mutable authored project data.
 *
 * The engine/client depends on this contract rather than on D1 itself. The
 * current browser build uses the Cloudflare implementation; a future local
 * distribution can implement the same two operations against local files.
 */
export interface ProjectPersistence {
  readProject(): Promise<ProjectSnapshot>;
  writeProject(mutation: ProjectMutation, context?: ProjectWriteContext): Promise<ProjectSnapshot>;
}
