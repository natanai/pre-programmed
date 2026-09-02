import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { AuthorWorkspaceContext } from "../features/types";
import type { AuthorTaskRoute } from "../tasks/types";
import { AuthorWorkspaceRenderer } from "./AuthorWorkspaceRenderer";
import type { AuthorWorkspaceSpec } from "./types";

export type AuthorWorkspaceSaveResult<TDraft> =
  | { accepted: true; draft?: TDraft }
  | { accepted: false };

export type AuthorWorkspaceBuildContext<TDraft> = {
  route: AuthorTaskRoute;
  context: AuthorWorkspaceContext;
  draft: TDraft;
  setDraft: Dispatch<SetStateAction<TDraft>>;
};

/**
 * Data-first Author workspace definition.
 *
 * The feature owns domain draft shape and persistence semantics. Core owns the
 * task lifecycle and visual grammar. A feature cannot add extra task headers or
 * footers through this contract because it returns AuthorWorkspaceSpec data,
 * not arbitrary workspace markup.
 */
export type AuthorWorkspaceDefinition<TDraft> = {
  id: string;
  matches: (route: AuthorTaskRoute) => boolean;
  createDraft: (route: AuthorTaskRoute, context: AuthorWorkspaceContext) => TDraft;
  buildSpec: (build: AuthorWorkspaceBuildContext<TDraft>) => AuthorWorkspaceSpec;
  signature?: (draft: TDraft) => string;
  save?: (build: AuthorWorkspaceBuildContext<TDraft>) => Promise<AuthorWorkspaceSaveResult<TDraft>>;
};

/** Preserve a feature's concrete draft type while exposing a heterogeneous registry entry. */
export function defineAuthorWorkspace<TDraft>(definition: AuthorWorkspaceDefinition<TDraft>) {
  return definition;
}

export type RegisteredAuthorWorkspaceDefinition = AuthorWorkspaceDefinition<unknown>;

function defaultSignature(value: unknown) {
  return JSON.stringify(value);
}

/**
 * Shared controller for data-first workspaces. Draft state, dirty state, Save
 * registration, and rendering are generic; only draft creation/spec/persistence
 * stay with the feature definition.
 */
export function StructuredAuthorWorkspace<TDraft>({
  definition,
  route,
  context,
}: {
  definition: AuthorWorkspaceDefinition<TDraft>;
  route: AuthorTaskRoute;
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

  useEffect(() => {
    if (!definition.save) {
      context.registerWorkspaceSave(null);
      return;
    }
    context.registerWorkspaceSave(async () => {
      const result = await definition.save!(build);
      if (!result.accepted) return false;
      const savedDraft = result.draft ?? build.draft;
      if (result.draft !== undefined) setDraft(savedDraft);
      setBaseline(signature(savedDraft));
      context.setWorkspaceDirty(false);
      return true;
    });
    return () => context.registerWorkspaceSave(null);
  }, [build, context.registerWorkspaceSave, context.setWorkspaceDirty, definition, signature]);

  return <AuthorWorkspaceRenderer spec={definition.buildSpec(build)} />;
}
