import type { ProjectMutation, ProjectSnapshot } from "../game/model";
import { configuredAuthorPlatform } from "../platform/author/configuredAuthorPlatform";
import { ApiError } from "../platform/cloudflare/http";
import { configuredProjectPersistence } from "../platform/persistence/configuredProjectPersistence";

export { API_ORIGIN, ApiError, apiUrl, readJson } from "../platform/cloudflare/http";

export const SNAPSHOT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000] as const;

export function authorLoginErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 503) return "AUTHOR ACCESS NOT CONFIGURED.";
  if (error instanceof ApiError && error.status === 401) return "ACCESS KEY DOES NOT MATCH.";
  return "AUTHOR LOGIN UNAVAILABLE.";
}

export function checkAuthorSession(token: string) {
  return configuredAuthorPlatform.checkSession(token);
}

export function loginAuthor(key: string) {
  return configuredAuthorPlatform.login(key);
}

export function downloadAuthorBackup(token: string) {
  return configuredAuthorPlatform.downloadBackup(token);
}

export async function fetchProjectSnapshot() {
  return configuredProjectPersistence.readProject();
}

function abortError() {
  const error = new Error("Snapshot synchronization was cancelled.");
  error.name = "AbortError";
  return error;
}

function waitForRetry(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function waitForProjectSnapshot(options: {
  signal?: AbortSignal;
  retryDelaysMs?: readonly number[];
  fetchSnapshot?: () => Promise<ProjectSnapshot>;
  onAttemptFailure?: (error: unknown, failureCount: number) => void;
} = {}) {
  const retryDelaysMs = options.retryDelaysMs ?? SNAPSHOT_RETRY_DELAYS_MS;
  const fetchSnapshot = options.fetchSnapshot ?? fetchProjectSnapshot;
  let failureCount = 0;
  while (!options.signal?.aborted) {
    try {
      return await fetchSnapshot();
    } catch (error) {
      if (options.signal?.aborted) throw abortError();
      failureCount += 1;
      options.onAttemptFailure?.(error, failureCount);
      const delayMs = retryDelaysMs[Math.min(failureCount - 1, retryDelaysMs.length - 1)] ?? 15_000;
      await waitForRetry(delayMs, options.signal);
    }
  }
  throw abortError();
}

export async function submitProjectMutation(token: string, mutation: ProjectMutation) {
  const snapshot = await configuredProjectPersistence.writeProject(mutation, { authorization: token });
  return { snapshot };
}

export async function fetchAuthorWorkspace(token: string) {
  return configuredAuthorPlatform.readWorkspace(token);
}

export async function undoLastRevision(token: string, expectedRevision: number) {
  return { snapshot: await configuredAuthorPlatform.undoLastRevision(token, expectedRevision) };
}
