import { useCallback, useRef, useState } from "react";
import type { AuthorWorkspaceSaveHandler } from "../features/types";
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

function afterReactTurn() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
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
 * The master close action is also the sole Author -> player exit boundary. It
 * can save every dirty task from deepest child to oldest parent before closing,
 * allowing child resource results to flow back into suspended parent drafts.
 */
export function useAuthorTaskRuntime() {
  const [tasks, setTasks] = useState<AuthorTaskEntry[]>([]);
  const tasksRef = useRef<AuthorTaskEntry[]>([]);
  const [leaveConfirmation, setLeaveConfirmation] = useState<AuthorLeaveConfirmation | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [saveAllError, setSaveAllError] = useState("");
  const completions = useRef(new Map<string, AuthorTaskCompletion>());
  const saveHandlers = useRef(new Map<string, AuthorWorkspaceSaveHandler>());
  const activeTask = tasks.at(-1) ?? null;
  const dirtyCount = tasks.filter((task) => task.dirty).length;

  const commitTasks = useCallback((next: AuthorTaskEntry[]) => {
    tasksRef.current = next;
    setTasks(next);
  }, []);

  const clearTransientCloseState = useCallback(() => {
    setLeaveConfirmation(null);
    setSaveAllError("");
    setSavingAll(false);
  }, []);

  const openTask = useCallback((route: AuthorTaskRoute) => {
    const task = taskFor(route);
    completions.current.clear();
    saveHandlers.current.clear();
    clearTransientCloseState();
    commitTasks([task]);
    return task.id;
  }, [clearTransientCloseState, commitTasks]);

  const pushTask = useCallback((route: AuthorTaskRoute, onComplete?: AuthorTaskCompletion) => {
    const task = taskFor(route);
    if (onComplete) completions.current.set(task.id, onComplete);
    clearTransientCloseState();
    commitTasks([...tasksRef.current, task]);
    return task.id;
  }, [clearTransientCloseState, commitTasks]);

  const popTask = useCallback((expectedTaskId?: string, result?: AuthorTaskResult) => {
    const next = popActiveAuthorTask(tasksRef.current, expectedTaskId);
    if (!next.popped) return false;
    const completion = completions.current.get(next.popped.id);
    completions.current.delete(next.popped.id);
    saveHandlers.current.delete(next.popped.id);
    clearTransientCloseState();
    commitTasks(next.tasks);
    if (completion) queueMicrotask(() => completion(result));
    return true;
  }, [clearTransientCloseState, commitTasks]);

  const completeTask = useCallback((taskId: string, result?: AuthorTaskResult) => {
    popTask(taskId, result);
  }, [popTask]);

  const closeAll = useCallback(() => {
    completions.current.clear();
    saveHandlers.current.clear();
    clearTransientCloseState();
    commitTasks([]);
  }, [clearTransientCloseState, commitTasks]);

  const setTaskDirty = useCallback((taskId: string, dirty: boolean) => {
    const next = setAuthorTaskDirtyState(tasksRef.current, taskId, dirty);
    if (next !== tasksRef.current) commitTasks(next);
  }, [commitTasks]);

  const registerTaskSave = useCallback((taskId: string, handler: AuthorWorkspaceSaveHandler | null) => {
    if (handler) saveHandlers.current.set(taskId, handler);
    else saveHandlers.current.delete(taskId);
  }, []);

  const requestBack = useCallback((taskId?: string) => {
    const active = tasksRef.current.at(-1);
    if (!active || (taskId && active.id !== taskId)) return;
    if (active.dirty) {
      setSaveAllError("");
      setLeaveConfirmation({ action: "back", dirtyCount: 1, taskId: active.id });
      return;
    }
    popTask(active.id);
  }, [popTask]);

  const requestClose = useCallback(() => {
    const current = tasksRef.current;
    if (!current.length) return;
    const currentDirtyCount = current.filter((task) => task.dirty).length;
    if (currentDirtyCount) {
      setSaveAllError("");
      setLeaveConfirmation({ action: "close", dirtyCount: currentDirtyCount });
      return;
    }
    closeAll();
  }, [closeAll]);

  const discardAndLeave = useCallback(() => {
    if (leaveConfirmation?.action === "back") popTask(leaveConfirmation.taskId);
    else if (leaveConfirmation?.action === "close") closeAll();
  }, [closeAll, leaveConfirmation, popTask]);

  const saveAllAndClose = useCallback(async () => {
    if (leaveConfirmation?.action !== "close" || savingAll) return false;
    setSavingAll(true);
    setSaveAllError("");
    try {
      let attempts = 0;
      while (true) {
        const dirtyTask = [...tasksRef.current].reverse().find((task) => task.dirty);
        if (!dirtyTask) {
          closeAll();
          return true;
        }
        if (attempts++ > 100) {
          setSaveAllError("Could not finish saving the Author task stack.");
          return false;
        }
        const save = saveHandlers.current.get(dirtyTask.id);
        if (!save) {
          setSaveAllError("One unsaved task has not migrated to the shared Save boundary yet. Save that task normally before using Save All.");
          return false;
        }
        const accepted = await save();
        if (!accepted) {
          setSaveAllError("A task could not be saved. Nothing was discarded; fix that task and try again.");
          return false;
        }
        // Mark the task clean at the runtime boundary immediately. Its editor
        // will also reconcile its local baseline after persistence succeeds.
        const stillPresent = tasksRef.current.some((task) => task.id === dirtyTask.id);
        if (stillPresent) setTaskDirty(dirtyTask.id, false);
        // Resource-task saves may pop the child and queue a completion callback
        // that updates the parent's suspended draft. Let that propagation finish
        // before selecting the next dirty parent.
        await afterReactTurn();
      }
    } finally {
      setSavingAll(false);
    }
  }, [closeAll, leaveConfirmation, savingAll, setTaskDirty]);

  const cancelLeave = useCallback(() => {
    setLeaveConfirmation(null);
    setSaveAllError("");
  }, []);

  return {
    tasks,
    activeTask,
    activeTaskId: activeTask?.id ?? null,
    hasTasks: tasks.length > 0,
    depth: tasks.length,
    hasDirty: dirtyCount > 0,
    dirtyCount,
    leaveConfirmation,
    savingAll,
    saveAllError,
    openTask,
    pushTask,
    completeTask,
    setTaskDirty,
    registerTaskSave,
    requestBack,
    requestClose,
    discardAndLeave,
    saveAllAndClose,
    cancelLeave,
    closeAll,
  };
}
