import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AuthorBookmark, PlayState, ProjectSnapshot } from "../../engine/project/model";
import { AuthorToolIndex, type AuthorToolGroup } from "../AuthorToolIndex";
import type { AuthorSearchEntry } from "../search/types";
import { describeAuthorTask, getAuthorCommandTargetAdapter, renderAuthorFeatureWorkspace } from "../features/registry";
import { AuthorQuickFind } from "../search/AuthorQuickFind";
import type { AuthorPersist, AuthorRuntimeSurface, AuthorWorkspaceContext, AuthorWorkspaceSaveHandler } from "../features/types";
import { AuthorResourceProvider } from "../resources/context";
import { buildAuthorResourceTools } from "../resources/runtime";
import type { AuthorResourceTools } from "../resources/types";
import type {
  AuthorLeaveConfirmation,
  AuthorTaskCompletion,
  AuthorTaskEntry,
  AuthorTaskResult,
  AuthorTaskRoute,
} from "../tasks/types";

type SharedTaskProps = {
  toolGroups: AuthorToolGroup[];
  searchEntries: AuthorSearchEntry[];
  snapshot: ProjectSnapshot;
  playState: PlayState;
  authorMode: boolean;
  authorToken: string;
  persist: AuthorPersist;
  completeTask: (taskId: string, result?: AuthorTaskResult) => void;
  requestBack: (taskId?: string) => void;
  setTaskDirty: (taskId: string, dirty: boolean) => void;
  registerTaskSave: (taskId: string, handler: AuthorWorkspaceSaveHandler | null) => void;
  pushTask: (route: AuthorTaskRoute, onComplete?: AuthorTaskCompletion) => string;
  runtime: AuthorRuntimeSurface;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
};

type PreservedWorkspaceView = {
  focusedElement: HTMLElement | null;
  scrollPositions: Array<{ element: HTMLElement; top: number; left: number }>;
};

function AuthorTaskSurface({
  task,
  active,
  resources,
  toolGroups,
  searchEntries,
  snapshot,
  playState,
  authorMode,
  authorToken,
  persist,
  completeTask,
  requestBack,
  setTaskDirty,
  registerTaskSave,
  pushTask,
  runtime,
  onSnapshot,
  onRestore,
}: SharedTaskProps & { task: AuthorTaskEntry; active: boolean; resources: AuthorResourceTools }) {
  const completeCurrentTask = useCallback(
    (result?: AuthorTaskResult) => completeTask(task.id, result),
    [completeTask, task.id],
  );
  const leaveCurrentTask = useCallback(() => requestBack(task.id), [requestBack, task.id]);
  const setWorkspaceDirty = useCallback(
    (dirty: boolean) => setTaskDirty(task.id, dirty),
    [setTaskDirty, task.id],
  );
  const registerWorkspaceSave = useCallback(
    (handler: AuthorWorkspaceSaveHandler | null) => registerTaskSave(task.id, handler),
    [registerTaskSave, task.id],
  );

  const context: AuthorWorkspaceContext = {
    taskId: task.id,
    snapshot,
    playState,
    authorMode,
    authorToken,
    persist,
    completeTask: completeCurrentTask,
    leaveCurrentTask,
    setWorkspaceDirty,
    registerWorkspaceSave,
    pushTask,
    resources,
    resolveCommandTarget: getAuthorCommandTargetAdapter,
    runtime,
    onSnapshot,
    onRestore,
  };
  const workspace = task.route.type === "tools"
    ? <AuthorToolIndex groups={toolGroups} searchEntries={searchEntries} />
    : renderAuthorFeatureWorkspace(task.route, context);
  if (!workspace) return null;

  return <div
    className={`author-task-surface${active ? " is-active" : " is-suspended"}`}
    data-task-id={task.id}
    aria-hidden={!active}
    style={active ? undefined : { display: "none" }}
  >
    <AuthorResourceProvider tools={resources}>{workspace}</AuthorResourceProvider>
  </div>;
}

function scrollableWorkspaceElements(layer: HTMLElement) {
  const activeSurface = layer.querySelector<HTMLElement>(".author-task-surface.is-active");
  if (!activeSurface) return [];
  const candidates = [
    activeSurface,
    ...activeSurface.querySelectorAll<HTMLElement>(
      ".author-panel-body, .definition-detail-scroll, .definition-index-scroll, .author-quick-find-panel",
    ),
  ];
  return candidates.filter((element, index, all) =>
    all.indexOf(element) === index && (element.scrollTop !== 0 || element.scrollLeft !== 0 || element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth),
  );
}

/**
 * Root host for nested Author tasks.
 *
 * Suspended tasks remain mounted under stable task ids, preserving local draft
 * state exactly as the author left it. Only the top task is visible. Each task
 * receives task-scoped completion, dirty ownership, and a registered save
 * boundary so the master close action can save the entire stack deepest-first.
 */
export function AuthorWorkspaceHost({
  tasks,
  activeTaskId,
  leaveConfirmation,
  savingAll,
  saveAllError,
  onSaveAllAndClose,
  onDiscardAndLeave,
  onCancelLeave,
  ...shared
}: SharedTaskProps & {
  tasks: AuthorTaskEntry[];
  activeTaskId: string | null;
  leaveConfirmation: AuthorLeaveConfirmation | null;
  savingAll: boolean;
  saveAllError: string;
  onSaveAllAndClose: () => void;
  onDiscardAndLeave: () => void;
  onCancelLeave: () => void;
}) {
  const [stackOpen, setStackOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const workspaceLayerRef = useRef<HTMLDivElement>(null);
  const preservedViewRef = useRef<PreservedWorkspaceView | null>(null);

  useEffect(() => setStackOpen(false), [activeTaskId]);

  const preview = useCallback<AuthorRuntimeSurface["preview"]>((presentation) => {
    const layer = workspaceLayerRef.current;
    const activeElement = document.activeElement instanceof HTMLElement && layer?.contains(document.activeElement)
      ? document.activeElement
      : null;
    preservedViewRef.current = {
      focusedElement: activeElement,
      scrollPositions: layer
        ? scrollableWorkspaceElements(layer).map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }))
        : [],
    };
    activeElement?.blur();
    shared.runtime.preview(presentation);
    setStackOpen(false);
    setPreviewing(true);
  }, [shared.runtime]);

  const resumeEditing = useCallback(() => {
    setPreviewing(false);
    window.requestAnimationFrame(() => {
      const preserved = preservedViewRef.current;
      if (!preserved) return;
      preserved.scrollPositions.forEach(({ element, top, left }) => element.scrollTo({ top, left }));
      preserved.focusedElement?.focus({ preventScroll: true });
      preservedViewRef.current = null;
    });
  }, []);

  const authorRuntime = useMemo<AuthorRuntimeSurface>(() => ({ ...shared.runtime, preview }), [preview, shared.runtime]);

  if (!tasks.length) return null;
  const resources = buildAuthorResourceTools(shared.snapshot, shared.pushTask);
  const taskLabels = tasks.map((task) => ({ id: task.id, label: describeAuthorTask(task.route, shared.snapshot) }));
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? tasks.at(-1);
  const parentLabel = taskLabels.at(-2)?.label;
  const returnsToParent = activeTask?.route.type === "feature" && Boolean(activeTask.route.data?.resourceTask) && parentLabel;
  const taskShared = { ...shared, runtime: authorRuntime };

  return createPortal(
    <>
      <div
        ref={workspaceLayerRef}
        className={`author-workspace-layer${previewing ? " is-previewing" : ""}`}
        role="presentation"
        aria-hidden={previewing || undefined}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <nav className="author-workspace-navigation" aria-label="Author task navigation">
          <div className="author-workspace-primary-actions">
            <button
              type="button"
              className="author-workspace-back"
              onClick={() => shared.requestBack(activeTaskId ?? undefined)}
            >
              <span className="author-workspace-back-wide">[← BACK]</span>
              <span className="author-workspace-back-compact">[BACK]</span>
            </button>
            {activeTask?.route.type !== "tools" ? <button className="author-workspace-tools" type="button" onClick={() => shared.pushTask({ type: "tools" })}>[TOOLS]</button> : null}
            <div className="author-workspace-find-slot" onPointerDown={() => setStackOpen(false)}>
              <AuthorQuickFind entries={shared.searchEntries} />
            </div>
            <button className="author-workspace-stack-toggle" type="button" aria-expanded={stackOpen} onClick={() => setStackOpen((open) => !open)}>[STACK]</button>
          </div>

          <div className="author-workspace-navigation-context">
            <ol className="author-task-trail" aria-label="Author task trail">
              {taskLabels.map((task, index) => <li key={task.id} aria-current={index === taskLabels.length - 1 ? "page" : undefined}>
                <span>{task.label}</span>
              </li>)}
            </ol>
            {returnsToParent ? <span className="author-task-return">SAVE RETURNS TO {parentLabel}</span> : null}
          </div>

          {stackOpen ? <div className="author-workspace-stack-panel">
            <span className="author-workspace-stack-heading">TASK STACK · {taskLabels.length} {taskLabels.length === 1 ? "TASK" : "TASKS"}</span>
            <ol className="author-task-trail" aria-label="Full Author task stack">
              {taskLabels.map((task, index) => <li key={task.id} aria-current={index === taskLabels.length - 1 ? "page" : undefined}>
                <span>{task.label}</span>
              </li>)}
            </ol>
            {returnsToParent ? <span className="author-task-return">SAVE RETURNS TO {parentLabel}</span> : null}
          </div> : null}
        </nav>
        <div className="author-workspace-content">
          {tasks.map((task) => <AuthorTaskSurface
            key={task.id}
            {...taskShared}
            task={task}
            active={task.id === activeTaskId}
            resources={resources}
          />)}
        </div>
        {leaveConfirmation ? <div className="author-leave-shade">
          <section
            className="author-leave-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="author-leave-title"
            aria-describedby="author-leave-copy"
          >
            <h2 id="author-leave-title">{leaveConfirmation.action === "close" ? "RETURN TO PLAYER" : "UNSAVED CHANGES"}</h2>
            <p id="author-leave-copy">
              {leaveConfirmation.action === "close"
                ? `${leaveConfirmation.dirtyCount} Author ${leaveConfirmation.dirtyCount === 1 ? "task has" : "tasks have"} unsaved work. Save all work before returning to play, or discard it.`
                : "This Author task contains unsaved changes."}
            </p>
            {saveAllError ? <p className="author-leave-error" role="alert">{saveAllError}</p> : null}
            <div className="author-leave-actions">
              <button type="button" autoFocus disabled={savingAll} onClick={onCancelLeave}>[KEEP EDITING]</button>
              {leaveConfirmation.action === "close" ? <button type="button" disabled={savingAll} onClick={onSaveAllAndClose}>[{savingAll ? "SAVING ALL..." : "SAVE ALL & RETURN"}]</button> : null}
              <button type="button" disabled={savingAll} onClick={onDiscardAndLeave}>[{leaveConfirmation.action === "close" ? "DISCARD ALL & RETURN" : "DISCARD CHANGES"}]</button>
            </div>
          </section>
        </div> : null}
      </div>
      {previewing ? <button type="button" className="author-preview-resume" onClick={resumeEditing}>[RESUME EDITING]</button> : null}
    </>,
    document.body,
  );
}
