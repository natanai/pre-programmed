import { createPortal } from "react-dom";
import type { AuthorBookmark, PlayState, ProjectSnapshot } from "../../game/model";
import { AuthorToolIndex, type AuthorToolGroup } from "../AuthorToolIndex";
import { renderAuthorFeatureWorkspace } from "../features/registry";
import type { AuthorPersist, AuthorRuntimeSurface } from "../features/types";
import { AuthorResourceProvider } from "../resources/context";
import { buildAuthorResourceTools } from "../resources/runtime";
import type {
  AuthorLeaveConfirmation,
  AuthorTaskCompletion,
  AuthorTaskEntry,
  AuthorTaskResult,
  AuthorTaskRoute,
} from "../tasks/types";

/**
 * Root host for nested Author tasks.
 *
 * Suspended tasks remain mounted under stable task ids, preserving local draft
 * state exactly as the author left it. Only the top task is visible. Each task
 * receives dirty-state ownership scoped to its own id plus the same generic
 * resource task runtime, so cross-feature creation never needs parent-specific
 * callbacks or feature imports.
 */
export function AuthorWorkspaceHost({
  tasks,
  activeTaskId,
  toolGroups,
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
  leaveConfirmation,
  onConfirmLeave,
  onCancelLeave,
}: {
  tasks: AuthorTaskEntry[];
  activeTaskId: string | null;
  toolGroups: AuthorToolGroup[];
  snapshot: ProjectSnapshot;
  playState: PlayState;
  authorMode: boolean;
  authorToken: string;
  persist: AuthorPersist;
  completeTask: (result?: AuthorTaskResult) => void;
  requestBack: () => void;
  setTaskDirty: (taskId: string, dirty: boolean) => void;
  pushTask: (route: AuthorTaskRoute, onComplete?: AuthorTaskCompletion) => string;
  runtime: AuthorRuntimeSurface;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
  leaveConfirmation: AuthorLeaveConfirmation | null;
  onConfirmLeave: () => void;
  onCancelLeave: () => void;
}) {
  if (!tasks.length) return null;
  const resources = buildAuthorResourceTools(snapshot, pushTask);

  return createPortal(
    <div
      className="author-workspace-layer"
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <nav className="author-workspace-navigation" aria-label="Author task navigation">
        <button
          type="button"
          className="author-workspace-back"
          onClick={requestBack}
        >
          [← BACK]
        </button>
        {tasks.length > 1 ? <span className="author-task-depth" aria-label={`${tasks.length} nested Author tasks`}>TASK {tasks.length}</span> : null}
      </nav>
      <div className="author-workspace-content">
        {tasks.map((task) => {
          const active = task.id === activeTaskId;
          const context = {
            taskId: task.id,
            snapshot,
            playState,
            authorMode,
            authorToken,
            persist,
            completeTask,
            leaveCurrentTask: requestBack,
            setWorkspaceDirty: (dirty: boolean) => setTaskDirty(task.id, dirty),
            pushTask,
            resources,
            runtime,
            onSnapshot,
            onRestore,
          };
          const workspace = task.route.type === "tools"
            ? <AuthorToolIndex groups={toolGroups} />
            : renderAuthorFeatureWorkspace(task.route, context);
          if (!workspace) return null;
          return <div
            key={task.id}
            className={`author-task-surface${active ? " is-active" : " is-suspended"}`}
            aria-hidden={!active}
            style={active ? undefined : { display: "none" }}
          >
            <AuthorResourceProvider tools={resources}>{workspace}</AuthorResourceProvider>
          </div>;
        })}
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
