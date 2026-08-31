import type { ProjectMutation, ProjectSnapshot } from "../../engine/project/model";

export type ProjectWriteContext = {
  /** Hosted stores may require a credential; local stores can ignore it. */
  authorization?: string;
};

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
