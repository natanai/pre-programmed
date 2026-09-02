import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AuthorBookmark, PlayState, ProjectSnapshot } from "../../engine/project/model";
import { AuthorToolIndex, type AuthorToolGroup } from "../AuthorToolIndex";
import type { AuthorSearchEntry } from "../search/types";
import { describeAuthorTask, getAuthorCommandTargetAdapter, renderAuthorFeatureWorkspace } from "../features/registry";
import { AuthorQuickFind } from "../search/AuthorQuickFind";
import type { AuthorPersist, AuthorRuntimeSurface, AuthorWorkspaceContext } from "../features/types";
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
 * receives task-scoped completion and dirty ownership plus the same generic
 * resource runtime, so a suspended task cannot accidentally affect its child.
 */
export function AuthorWorkspaceHost({
  tasks,
  activeTaskId,
  leaveConfirmation,
  onConfirmLeave,
  onCancelLeave,
  ...shared
}: SharedTaskProps & {
  tasks: AuthorTaskEntry[];
  activeTaskId: string | null;
  leaveConfirmation: AuthorLeaveConfirmation | null;
  onConfirmLeave: () => void;
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
  const activeLabel = taskLabels.find((task) => task.id === activeTask?.id)?.label ?? "AUTHOR";
  const parentLabel = taskLabels.at(-2)?.label;
  const behindCount = Math.max(0, taskLabels.length - 1);
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
          <div className="author-workspace-navigation-standard">
            <div className="author-workspace-navigation-actions">
              <button
                type="button"
                className="author-workspace-back"
                onClick={() => shared.requestBack(activeTaskId ?? undefined)}
              >
                [← BACK]
              </button>
              {activeTask?.route.type !== "tools" ? <button type="button" onClick={() => shared.pushTask({ type: "tools" })}>[TOOLS]</button> : null}
              <AuthorQuickFind entries={shared.searchEntries} />
            </div>
            <ol className="author-task-trail" aria-label="Author task trail">
              {taskLabels.map((task, index) => <li key={task.id} aria-current={index === taskLabels.length - 1 ? "page" : undefined}>
                <span>{task.label}</span>
              </li>)}
            </ol>
            {returnsToParent ? <span className="author-task-return">SAVE RETURNS TO {parentLabel}</span> : null}
          </div>

          <div className="author-workspace-keyboard-bar" aria-label="Compact Author task navigation">
            <button
              type="button"
              className="author-workspace-back"
              onClick={() => shared.requestBack(activeTaskId ?? undefined)}
            >[BACK]</button>
            <span className="author-workspace-current-task" title={activeLabel}>
              <strong>{activeLabel}</strong>{behindCount ? <small> · {behindCount} behind</small> : null}
            </span>
            <button type="button" aria-expanded={stackOpen} onClick={() => setStackOpen((open) => !open)}>[STACK]</button>
          </div>

          {stackOpen ? <div className="author-workspace-stack-panel">
            <div className="author-workspace-navigation-actions">
              {activeTask?.route.type !== "tools" ? <button type="button" onClick={() => shared.pushTask({ type: "tools" })}>[TOOLS]</button> : null}
              <AuthorQuickFind entries={shared.searchEntries} />
            </div>
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
            <h2 id="author-leave-title">UNSAVED CHANGES</h2>
            <p id="author-leave-copy">
              {leaveConfirmation.action === "close" && leaveConfirmation.dirtyCount > 1
                ? `${leaveConfirmation.dirtyCount} Author tasks contain unsaved changes.`
                : "This Author task contains unsaved changes."}
            </p>
            <div className="author-leave-actions">
              <button type="button" autoFocus onClick={onCancelLeave}>[KEEP EDITING]</button>
              <button type="button" onClick={onConfirmLeave}>[DISCARD CHANGES]</button>
            </div>
          </section>
        </div> : null}
      </div>
      {previewing ? <button type="button" className="author-preview-resume" onClick={resumeEditing}>[RESUME EDITING]</button> : null}
    </>,
    document.body,
  );
}
