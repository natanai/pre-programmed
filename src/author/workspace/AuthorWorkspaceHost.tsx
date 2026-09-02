import { useCallback } from "react";
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
  if (!tasks.length) return null;
  const resources = buildAuthorResourceTools(shared.snapshot, shared.pushTask);
  const taskLabels = tasks.map((task) => ({ id: task.id, label: describeAuthorTask(task.route, shared.snapshot) }));
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? tasks.at(-1);
  const parentLabel = taskLabels.at(-2)?.label;
  const returnsToParent = activeTask?.route.type === "feature" && Boolean(activeTask.route.data?.resourceTask) && parentLabel;

  return createPortal(
    <div
      className="author-workspace-layer"
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <nav className="author-workspace-navigation" aria-label="Author task navigation">
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
      </nav>
      <div className="author-workspace-content">
        {tasks.map((task) => <AuthorTaskSurface
          key={task.id}
          {...shared}
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
    </div>,
    document.body,
  );
}
