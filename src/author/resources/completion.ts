import type { AuthorWorkspaceContext } from "../features/types";
import type { AuthorTaskResult } from "../tasks/types";

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

/**
 * Interpret only authoritative child-task outcomes for a resource reference.
 * Snapshot membership is intentionally not an input: optimistic project state
 * may temporarily remove a resource before persistence later rejects/conflicts.
 */
export function reconciledAuthorReferenceValue(
  kind: string,
  currentValue: string,
  result?: AuthorTaskResult,
): string | undefined {
  if (!result) return undefined;
  if (result.type === "resource" && result.kind === kind) return result.value;
  if (result.type === "resource-deleted" && result.kind === kind && result.id === currentValue) return "";
  return undefined;
}
