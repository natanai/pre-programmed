from pathlib import Path

path = Path("src/author/workspace/AuthorWorkspaceHost.tsx")
text = path.read_text()

old_ref = "  const saveHandlersRef = useRef(new Map<string, AuthorWorkspaceSaveHandler>());\n  const returnFocusRef = useRef(new Map<string, HTMLElement>());\n"
new_ref = "  const saveHandlersRef = useRef(new Map<string, AuthorWorkspaceSaveHandler>());\n  const returnFocusRef = useRef(new Map<string, HTMLElement>());\n  const liveTasksRef = useRef(tasks);\n  liveTasksRef.current = tasks;\n"
assert text.count(old_ref) == 1, "save handler refs source shape changed"
text = text.replace(old_ref, new_ref, 1)

old = '''  const saveAllAndReturn = useCallback(async () => {
    if (savingAll) return;
    setSavingAll(true);
    setSaveAllError("");
    try {
      const dirtyTasks = [...tasks].filter((task) => task.dirty).reverse();
      for (const task of dirtyTasks) {
        const taskLabel = describeAuthorTask(task.route, shared.snapshot);
        const save = saveHandlersRef.current.get(task.id);
        if (!save) {
          setSaveAllError(`${taskLabel} has unsaved work but no registered Save action. Nothing was discarded; keep editing and return to that task.`);
          return;
        }
        const accepted = await save();
        if (!accepted) {
          setSaveAllError(`${taskLabel} could not be saved. Nothing was discarded; keep editing and use Back until that task is visible.`);
          return;
        }
        shared.setTaskDirty(task.id, false);
        await afterReactTurn();
      }
      onConfirmLeave();
    } finally {
      setSavingAll(false);
    }
  }, [onConfirmLeave, savingAll, shared, tasks]);
'''
new = '''  const saveAllAndReturn = useCallback(async () => {
    if (savingAll) return;
    setSavingAll(true);
    setSaveAllError("");
    try {
      // Re-read the live stack after every accepted save. Saving a nested
      // resource may complete that child and update a previously clean parent
      // reference, making the parent dirty only after the child has returned.
      // A one-time dirty snapshot would miss that new parent work and could
      // discard it while closing Author mode.
      while (true) {
        const task = [...liveTasksRef.current].reverse().find((candidate) => candidate.dirty);
        if (!task) break;
        const taskLabel = describeAuthorTask(task.route, shared.snapshot);
        const save = saveHandlersRef.current.get(task.id);
        if (!save) {
          setSaveAllError(`${taskLabel} has unsaved work but no registered Save action. Nothing was discarded; keep editing and return to that task.`);
          return;
        }
        const accepted = await save();
        if (!accepted) {
          setSaveAllError(`${taskLabel} could not be saved. Nothing was discarded; keep editing and use Back until that task is visible.`);
          return;
        }
        shared.setTaskDirty(task.id, false);
        // Child completion callbacks run in a microtask and may update the
        // suspended parent draft. Give React a turn to publish any resulting
        // parent dirty state before choosing the next deepest task.
        await afterReactTurn();
      }
      onConfirmLeave();
    } finally {
      setSavingAll(false);
    }
  }, [onConfirmLeave, savingAll, shared]);
'''
assert text.count(old) == 1, "saveAllAndReturn source shape changed"
text = text.replace(old, new, 1)

assert "const dirtyTasks = [...tasks]" not in text
assert "liveTasksRef.current" in text
path.write_text(text)
