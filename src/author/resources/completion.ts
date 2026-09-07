import type { AuthorWorkspaceContext } from "../features/types";

/**
 * Finish a canonical resource deletion through the existing task-result channel.
 * Nested editors report the accepted deletion to their suspended parent; root
 * editors preserve ordinary completed-task behavior and return to Author Tools.
 */
export function completeAuthorResourceDeletion(
  context: AuthorWorkspaceContext,
  kind: string,
  id: string,
) {
  if (context.hasParentTask) {
    context.completeTask({ type: "resource-deleted", kind, id });
    return;
  }
  context.leaveCurrentTask();
}
