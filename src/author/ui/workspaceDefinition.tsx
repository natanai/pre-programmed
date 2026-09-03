import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { AuthorWorkspaceContext } from "../features/types";
import type { AuthorTaskResult, AuthorTaskRoute } from "../tasks/types";
import { AuthorWorkspaceRenderer } from "./AuthorWorkspaceRenderer";
import type { AuthorWorkspaceSpec } from "./types";

export type AuthorFeatureTaskRoute = Extract<AuthorTaskRoute, { type: "feature" }>;

export type AuthorWorkspaceSaveResult<TDraft> =
  | { accepted: true; draft?: TDraft; completion?: AuthorTaskResult }
  | { accepted: false };

export type AuthorWorkspaceBuildContext<TDraft> = {
  route: AuthorFeatureTaskRoute;
  context: AuthorWorkspaceContext;
  draft: TDraft;
  setDraft: Dispatch<SetStateAction<TDraft>>;
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
 * registration, contextual Back, and rendering are generic; only draft
 * creation/spec/persistence stay with the feature definition.
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
  const currentSignature = signature(draft);
  const dirty = currentSignature !== baseline;

  useEffect(() => {
    context.setWorkspaceDirty(dirty);
    return () => context.setWorkspaceDirty(false);
  }, [context.setWorkspaceDirty, dirty]);

  const build = useMemo<AuthorWorkspaceBuildContext<TDraft>>(
    () => ({ route, context, draft, setDraft }),
    [context, draft, route],
  );

  const save = useCallback(async () => {
    if (!definition.save) return true;
    const result = await definition.save(build);
    if (!result.accepted) return false;
    const savedDraft = result.draft ?? build.draft;
    if (result.draft !== undefined) setDraft(savedDraft);
    setBaseline(signature(savedDraft));
    context.setWorkspaceDirty(false);
    if (result.completion && context.hasParentTask) context.completeTask(result.completion);
    return true;
  }, [build, context, definition, signature]);

  useEffect(() => {
    if (!definition.save) {
      context.registerWorkspaceSave(null);
      return;
    }
    context.registerWorkspaceSave(save);
    return () => context.registerWorkspaceSave(null);
  }, [context.registerWorkspaceSave, definition.save, save]);

  const authoredSpec = definition.buildSpec(build);
  const spec: AuthorWorkspaceSpec = {
    ...authoredSpec,
    actions: [
      ...(definition.save ? [{
        id: "author-core-save",
        label: definition.saveLabel ?? "SAVE",
        disabled: !dirty,
        onAction: () => { void save(); },
      }] : []),
      ...(context.hasParentTask ? [{
        id: "author-core-back",
        label: "BACK",
        onAction: context.leaveCurrentTask,
      }] : []),
      ...(authoredSpec.actions ?? []),
    ],
  };

  return <AuthorWorkspaceRenderer spec={spec} />;
}
