import type { AuthorTaskEntry } from "./types";

/** Update one task without manufacturing a new stack when nothing changed. */
export function setAuthorTaskDirtyState(
  tasks: AuthorTaskEntry[],
  taskId: string,
  dirty: boolean,
): AuthorTaskEntry[] {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task || task.dirty === dirty) return tasks;
  return tasks.map((candidate) => candidate.id === taskId ? { ...candidate, dirty } : candidate);
}

/** Pop only the task the caller owns; a suspended task cannot dismiss its child. */
export function popActiveAuthorTask(
  tasks: AuthorTaskEntry[],
  expectedTaskId?: string,
): { tasks: AuthorTaskEntry[]; popped: AuthorTaskEntry | null } {
  const active = tasks.at(-1);
  if (!active || (expectedTaskId && active.id !== expectedTaskId)) return { tasks, popped: null };
  return { tasks: tasks.slice(0, -1), popped: active };
}
