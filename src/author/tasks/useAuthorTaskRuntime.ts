import { useCallback, useRef, useState } from "react";
import { authorNavigationAllowed } from "./commitState";
import { popActiveAuthorTask, setAuthorTaskDirtyState } from "./taskStack";
import type {
  AuthorLeaveConfirmation,
  AuthorTaskCompletion,
  AuthorTaskEntry,
  AuthorTaskResult,
  AuthorTaskRoute,
} from "./types";

function taskFor(route: AuthorTaskRoute): AuthorTaskEntry {
  return { id: crypto.randomUUID(), route, dirty: false };
}

/**
 * Runtime owner for nested Author work.
 *
 * Every entry is a stable task, not merely a navigation breadcrumb. The host
 * keeps task workspaces mounted while they are suspended so unsaved local
 * editor state survives nested creation/editing. Dirty state and completion
 * are addressed by task id, so a suspended async task cannot alter or dismiss
 * whichever child happens to be active later.
 *
 * Back is cancellable task-to-parent navigation and therefore protects dirty
 * drafts. Task completion is different: once feature-owned work has already
 * completed durably, completion bypasses the dirty Back guard. Nested completion
 * returns to the suspended parent; root completion returns to Author Tools.
 * Only the master close command intentionally crosses Author -> player.
 *
 * User navigation is frozen while any durable Author commit is in flight. This
 * prevents the task stack from moving underneath an accepted Save/Delete/Reset,
 * while programmatic completeTask() remains available so the committed child
 * can still return its typed result to the suspended parent.
 */
export function useAuthorTaskRuntime() {
  const [tasks, setTasks] = useState<AuthorTaskEntry[]>([]);
  const tasksRef = useRef<AuthorTaskEntry[]>([]);
  const [leaveConfirmation, setLeaveConfirmation] = useState<AuthorLeaveConfirmation | null>(null);
  const completions = useRef(new Map<string, AuthorTaskCompletion>());
  const activeTask = tasks.at(-1) ?? null;
  const dirtyCount = tasks.filter((task) => task.dirty).length;

  const commitTasks = useCallback((next: AuthorTaskEntry[]) => {
    tasksRef.current = next;
    setTasks(next);
  }, []);

  const openTask = useCallback((route: AuthorTaskRoute) => {
    if (!authorNavigationAllowed()) return "";
    const task = taskFor(route);
    completions.current.clear();
    setLeaveConfirmation(null);
    commitTasks([task]);
    return task.id;
  }, [commitTasks]);

  const pushTask = useCallback((route: AuthorTaskRoute, onComplete?: AuthorTaskCompletion) => {
    if (!authorNavigationAllowed()) return "";
    const task = taskFor(route);
    if (onComplete) completions.current.set(task.id, onComplete);
    setLeaveConfirmation(null);
    commitTasks([...tasksRef.current, task]);
    return task.id;
  }, [commitTasks]);

  const popTask = useCallback((expectedTaskId?: string, result?: AuthorTaskResult) => {
    const next = popActiveAuthorTask(tasksRef.current, expectedTaskId);
    if (!next.popped) return false;
    const completion = completions.current.get(next.popped.id);
    completions.current.delete(next.popped.id);
    setLeaveConfirmation(null);
    commitTasks(next.tasks);
    if (completion) queueMicrotask(() => completion(result));
    return true;
  }, [commitTasks]);

  const completeTask = useCallback((taskId: string, result?: AuthorTaskResult) => {
    const current = tasksRef.current;
    const active = current.at(-1);
    if (!active || active.id !== taskId) return false;
    if (current.length <= 1) {
      // The task has already completed its owner-defined work. Do not route it
      // through Back/dirty confirmation; replace the finished root editor with
      // Author Tools while preserving the master X as the only exit to play.
      completions.current.clear();
      setLeaveConfirmation(null);
      commitTasks([taskFor({ type: "tools" })]);
      return true;
    }
    return popTask(taskId, result);
  }, [commitTasks, popTask]);

  const forceCloseAll = useCallback(() => {
    completions.current.clear();
    setLeaveConfirmation(null);
    commitTasks([]);
  }, [commitTasks]);

  const closeAll = useCallback(() => {
    if (!authorNavigationAllowed()) return false;
    forceCloseAll();
    return true;
  }, [forceCloseAll]);

  const setTaskDirty = useCallback((taskId: string, dirty: boolean) => {
    const next = setAuthorTaskDirtyState(tasksRef.current, taskId, dirty);
    if (next !== tasksRef.current) commitTasks(next);
  }, [commitTasks]);

  const requestBack = useCallback((taskId?: string) => {
    if (!authorNavigationAllowed()) return;
    const current = tasksRef.current;
    const active = current.at(-1);
    if (!active || (taskId && active.id !== taskId) || current.length <= 1) return;
    if (active.dirty) {
      setLeaveConfirmation({ action: "back", dirtyCount: 1, taskId: active.id });
      return;
    }
    popTask(active.id);
  }, [popTask]);

  const requestClose = useCallback(() => {
    if (!authorNavigationAllowed()) return;
    const current = tasksRef.current;
    if (!current.length) return;
    const currentDirtyCount = current.filter((task) => task.dirty).length;
    if (currentDirtyCount) {
      setLeaveConfirmation({ action: "close", dirtyCount: currentDirtyCount });
      return;
    }
    forceCloseAll();
  }, [forceCloseAll]);

  const confirmLeave = useCallback(() => {
    if (!authorNavigationAllowed()) return;
    if (leaveConfirmation?.action === "back") popTask(leaveConfirmation.taskId);
    else if (leaveConfirmation?.action === "close") forceCloseAll();
  }, [forceCloseAll, leaveConfirmation, popTask]);

  const cancelLeave = useCallback(() => setLeaveConfirmation(null), []);

  return {
    tasks,
    activeTask,
    activeTaskId: activeTask?.id ?? null,
    hasTasks: tasks.length > 0,
    depth: tasks.length,
    hasDirty: dirtyCount > 0,
    leaveConfirmation,
    openTask,
    pushTask,
    completeTask,
    setTaskDirty,
    requestBack,
    requestClose,
    confirmLeave,
    cancelLeave,
    closeAll,
  };
}
