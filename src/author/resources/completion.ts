import type { AuthorResourceDeletedResult, AuthorTaskResult } from "../tasks/types";
import type { AuthorResourceOption } from "./types";

/**
 * Compare one canonical resource kind before and after an accepted Author write.
 *
 * The owner-provided resource list is the contract for resource identity. A
 * resource task reports deletion only when exactly one previously available
 * resource disappeared by stable owner id. This deliberately does not inspect
 * mutation type names, so settings-backed resources (Commands/Radix) work too,
 * and a Media reset that removes a database override but leaves the repository
 * resource available is correctly treated as survival rather than deletion.
 */
export function authorResourceDeletionResult(
  kind: string,
  before: readonly AuthorResourceOption[],
  after: readonly AuthorResourceOption[],
): AuthorResourceDeletedResult | undefined {
  const afterIds = new Set(after.map((resource) => resource.id));
  const disappeared = before.filter((resource) => !afterIds.has(resource.id));
  if (disappeared.length !== 1) return undefined;
  const resource = disappeared[0];
  return {
    type: "resource-deleted",
    kind,
    id: resource.id,
    value: resource.value,
  };
}

/**
 * Interpret only authoritative child-task outcomes for a resource reference.
 * Snapshot membership is intentionally not an input: optimistic project state
 * may temporarily remove a resource before persistence later rejects/conflicts.
 */
export function reconciledAuthorReferenceValue(
  kind: string,
  currentValue: string,
  currentId: string | null | undefined,
  result?: AuthorTaskResult,
): string | undefined {
  if (!result) return undefined;
  if (result.type === "resource" && result.kind === kind) return result.value;
  if (
    result.type === "resource-deleted"
    && result.kind === kind
    && (result.value === currentValue || Boolean(currentId) && result.id === currentId)
  ) return "";
  return undefined;
}
