import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AuthorWorkspaceContext } from "../features/types";
import type { AuthorTaskResult, AuthorTaskRoute } from "../tasks/types";
import { AuthorWorkspaceRenderer } from "./AuthorWorkspaceRenderer";
import type { AuthorWorkspaceSpec } from "./types";

export type AuthorFeatureTaskRoute = Extract<AuthorTaskRoute, { type: "feature" }>;

export type AuthorWorkspaceSaveResult<TDraft> =
  | { accepted: true; draft?: TDraft; completion?: AuthorTaskResult }
  | { accepted: false };

export type AuthorWorkspaceSaveOptions = {
  /** Suppress nested resource-task completion when saving only to establish a child editor prerequisite. */
  completeTask?: boolean;
};

export type AuthorWorkspaceBuildContext<TDraft> = {
  route: AuthorFeatureTaskRoute;
  context: AuthorWorkspaceContext;
  draft: TDraft;
  setDraft: Dispatch<SetStateAction<TDraft>>;
  /** Shared controller-owned dirty state. Features may read it but must not create a second baseline. */
  dirty: boolean;
  /**
   * Adopt an asynchronously loaded canonical resource as the current clean draft.
   * Use only for loading persisted source data after task creation; ordinary edits
   * must continue through setDraft so they remain dirty.
   */
  adoptLoadedDraft: (draft: TDraft) => void;
  /** Shared task save boundary. Feature actions may save before nesting without creating another persistence path. */
  saveCurrentDraft?: (options?: AuthorWorkspaceSaveOptions) => Promise<boolean>;
};

/**
 * Data-first Author feature workspace definition.
 *
 * Feature-contributed workspaces only receive feature routes. Core narrows that
 * boundary once in the registry so feature editors can use their generic route
 * data without repeating shell-route guards throughout domain code.
 *
 * The feature owns domain draft shape and persistence semantics. Core owns the
 * task lifecycle and visual grammar. A feature cannot add extra task headers or
 * footers through this contract because it returns AuthorWorkspaceSpec data,
 * not arbitrary workspace markup.
 */
export type AuthorWorkspaceDefinition<TDraft> = {
  id: string;
  matches: (route: AuthorTaskRoute) => boolean;
  createDraft: (route: AuthorFeatureTaskRoute, context: AuthorWorkspaceContext) => TDraft;
  buildSpec: (build: AuthorWorkspaceBuildContext<TDraft>) => AuthorWorkspaceSpec;
  signature?: (draft: TDraft) => string;
  saveLabel?: string;
  /** Feature-domain validity only; dirty/task state remains core-owned. */
  canSave?: (build: AuthorWorkspaceBuildContext<TDraft>) => boolean;
  save?: (build: AuthorWorkspaceBuildContext<TDraft>) => Promise<AuthorWorkspaceSaveResult<TDraft>>;
};

/** Registry erases draft type only at the composition boundary. */
export type RegisteredAuthorWorkspaceDefinition = AuthorWorkspaceDefinition<any>;

/** Preserve a feature's concrete draft type while returning a registry-safe definition. */
export function defineAuthorWorkspace<TDraft>(definition: AuthorWorkspaceDefinition<TDraft>): RegisteredAuthorWorkspaceDefinition {
  return definition as RegisteredAuthorWorkspaceDefinition;
}

function defaultSignature(value: unknown) {
  return JSON.stringify(value);
}

/**
 * Shared controller for data-first workspaces. Draft state, dirty state, Save
 * registration, and rendering are generic; only draft creation/spec/persistence
 * stay with the feature definition. Author task Back/X navigation remains owned
 * by the shared workspace host so structured feature editors do not duplicate it.
 *
 * Save cannot be an implicit Author exit here. A completion result is honored
 * only when the task actually has an Author parent; root exit belongs to X.
 */
export function StructuredAuthorWorkspace<TDraft>({
  definition,
  route,
  context,
}: {
  definition: AuthorWorkspaceDefinition<TDraft>;
  route: AuthorFeatureTaskRoute;
  context: AuthorWorkspaceContext;
}) {
  const [draft, setDraft] = useState<TDraft>(() => definition.createDraft(route, context));
  const signature = definition.signature ?? defaultSignature;
  const [baseline, setBaseline] = useState(() => signature(draft));
  const [saving, setSaving] = useState(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const currentSignature = signature(draft);
  const dirty = currentSignature !== baseline;

  useEffect(() => {
    context.setWorkspaceDirty(dirty);
    return () => context.setWorkspaceDirty(false);
  }, [context.setWorkspaceDirty, dirty]);

  const adoptLoadedDraft = useCallback((loadedDraft: TDraft) => {
    setDraft(loadedDraft);
    setBaseline(signature(loadedDraft));
    context.setWorkspaceDirty(false);
  }, [context, signature]);

  const saveBuild = useMemo<AuthorWorkspaceBuildContext<TDraft>>(
    () => ({ route, context, draft, setDraft, dirty, adoptLoadedDraft }),
    [adoptLoadedDraft, context, dirty, draft, route],
  );
  const validForSave = definition.canSave?.(saveBuild) ?? true;

  const save = useCallback((options: AuthorWorkspaceSaveOptions = {}) => {
    if (savePromiseRef.current) return savePromiseRef.current;
    if (!definition.save || !validForSave) return Promise.resolve(false);

    const pending = (async () => {
      setSaving(true);
      try {
        const result = await definition.save(saveBuild);
        if (!result.accepted) return false;
        const savedDraft = result.draft ?? saveBuild.draft;
        if (result.draft !== undefined) setDraft(savedDraft);
        setBaseline(signature(savedDraft));
        context.setWorkspaceDirty(false);
        if (result.completion && options.completeTask !== false && context.hasParentTask) context.completeTask(result.completion);
        return true;
      } finally {
        setSaving(false);
        savePromiseRef.current = null;
      }
    })();
    savePromiseRef.current = pending;
    return pending;
  }, [context, definition, saveBuild, signature, validForSave]);

  const build = useMemo<AuthorWorkspaceBuildContext<TDraft>>(
    () => ({ ...saveBuild, saveCurrentDraft: save }),
    [save, saveBuild],
  );

  useEffect(() => {
    if (!definition.save) {
      context.registerWorkspaceSave(null);
      return;
    }
    context.registerWorkspaceSave(() => save());
    return () => context.registerWorkspaceSave(null);
  }, [context.registerWorkspaceSave, definition.save, save]);

  const authoredSpec = definition.buildSpec(build);
  const spec: AuthorWorkspaceSpec = {
    ...authoredSpec,
    actions: [
      ...(definition.save ? [{
        id: "author-core-save",
        label: saving ? "SAVING..." : definition.saveLabel ?? "SAVE",
        disabled: saving || !dirty || !validForSave,
        onAction: () => { void save(); },
      }] : []),
      ...(authoredSpec.actions ?? []),
    ],
  };

  return <AuthorWorkspaceRenderer spec={spec} busy={saving} />;
}
