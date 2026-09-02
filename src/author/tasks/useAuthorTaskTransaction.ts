import { useCallback, useMemo, useState } from "react";
import type { MutationOperation } from "../../engine/project/model";
import type { AuthorPersist } from "../features/types";
import type { AuthorPersistResult } from "../persistence/authorProjectPersistence";

export type AuthorStagedMutation = {
  key: string;
  description: string;
  operations: MutationOperation[];
};

export type AuthorTaskTransaction = {
  staged: readonly AuthorStagedMutation[];
  hasStaged: boolean;
  stage: (key: string, operations: MutationOperation[], description: string) => void;
  unstage: (key: string) => void;
  clear: () => void;
  commit: (description?: string) => Promise<AuthorPersistResult>;
};

/**
 * Task-local transaction boundary for structured Author workspaces.
 *
 * Child controls stage project mutations by stable key. Only the owning task can
 * publish them, preventing a nested choice from silently committing global state
 * while the surrounding editor remains an unsaved draft.
 */
export function useAuthorTaskTransaction(persist: AuthorPersist): AuthorTaskTransaction {
  const [staged, setStaged] = useState<AuthorStagedMutation[]>([]);

  const stage = useCallback((key: string, operations: MutationOperation[], description: string) => {
    setStaged((current) => current.some((entry) => entry.key === key)
      ? current.map((entry) => entry.key === key ? { key, operations, description } : entry)
      : [...current, { key, operations, description }]);
  }, []);

  const unstage = useCallback((key: string) => {
    setStaged((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const clear = useCallback(() => setStaged([]), []);

  const commit = useCallback(async (description?: string) => {
    const snapshot = [...staged];
    const operations = snapshot.flatMap((entry) => entry.operations);
    if (!operations.length) return { status: "failed", snapshot: null, message: "No staged Author changes." } as AuthorPersistResult;
    const result = await persist(
      operations,
      description ?? snapshot.map((entry) => entry.description).join("; "),
    );
    if (result.status === "saved" || result.status === "queued") setStaged([]);
    return result;
  }, [persist, staged]);

  return useMemo(() => ({ staged, hasStaged: staged.length > 0, stage, unstage, clear, commit }), [clear, commit, stage, staged, unstage]);
}
