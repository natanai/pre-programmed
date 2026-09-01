import { useCallback, useRef, useState } from "react";
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
 * editor state survives nested creation/editing. Dirty state is addressed by
 * task id, and a child task may return a typed result to its parent.
 */
export function useAuthorTaskRuntime() {
  const [tasks, setTasks] = useState<AuthorTaskEntry[]>([]);
  const [leaveConfirmation, setLeaveConfirmation] = useState<AuthorLeaveConfirmation | null>(null);
  const completions = useRef(new Map<string, AuthorTaskCompletion>());
  const activeTask = tasks.at(-1) ?? null;
  const dirtyCount = tasks.filter((task) => task.dirty).length;

  const openTask = useCallback((route: AuthorTaskRoute) => {
    const task = taskFor(route);
    completions.current.clear();
    setLeaveConfirmation(null);
    setTasks([task]);
    return task.id;
  }, []);

  const pushTask = useCallback((route: AuthorTaskRoute, onComplete?: AuthorTaskCompletion) => {
    const task = taskFor(route);
    if (onComplete) completions.current.set(task.id, onComplete);
    setLeaveConfirmation(null);
    setTasks((current) => [...current, task]);
    return task.id;
  }, []);

  const popTask = useCallback((result?: AuthorTaskResult) => {
    setLeaveConfirmation(null);
    setTasks((current) => {
      const task = current.at(-1);
      if (!task) return current;
      const completion = completions.current.get(task.id);
      completions.current.delete(task.id);
      if (completion) queueMicrotask(() => completion(result));
      return current.slice(0, -1);
    });
  }, []);

  const completeTask = useCallback((result?: AuthorTaskResult) => {
    popTask(result);
  }, [popTask]);

  const closeAll = useCallback(() => {
    completions.current.clear();
    setLeaveConfirmation(null);
    setTasks([]);
  }, []);

  const setTaskDirty = useCallback((taskId: string, dirty: boolean) => {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, dirty } : task));
  }, []);

  const requestBack = useCallback(() => {
    if (!activeTask) return;
    if (activeTask.dirty) {
      setLeaveConfirmation({ action: "back", dirtyCount: 1 });
      return;
    }
    popTask();
  }, [activeTask, popTask]);

  const requestClose = useCallback(() => {
    if (!tasks.length) return;
    if (dirtyCount) {
      setLeaveConfirmation({ action: "close", dirtyCount });
      return;
    }
    closeAll();
  }, [closeAll, dirtyCount, tasks.length]);

  const confirmLeave = useCallback(() => {
    const action = leaveConfirmation?.action;
    if (action === "back") popTask();
    else if (action === "close") closeAll();
  }, [closeAll, leaveConfirmation?.action, popTask]);

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
