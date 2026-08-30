import type {
  AuthorBookmark,
  ProjectMutation,
  ProjectSnapshot,
  RevisionSummary,
} from "../game/model";

export const API_ORIGIN = "https://pre-programmed.natanai.workers.dev";

export const SNAPSHOT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000] as const;

export function apiUrl(path: string) {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "terminal.local") {
    return path;
  }
  return `${API_ORIGIN}${path}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    let message = detail || `${response.status}`;
    try {
      const parsed = JSON.parse(detail) as { error?: unknown };
      if (typeof parsed.error === "string") message = parsed.error;
    } catch {
      // Preserve non-JSON response details for diagnostics.
    }
    throw new ApiError(response.status, message);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`API returned ${contentType || "an unknown content type"}; expected JSON.`);
  }
  return response.json() as Promise<T>;
}

export function authorLoginErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 503) return "AUTHOR ACCESS NOT CONFIGURED.";
  if (error instanceof ApiError && error.status === 401) return "ACCESS KEY DOES NOT MATCH.";
  return "AUTHOR LOGIN UNAVAILABLE.";
}

export async function fetchProjectSnapshot() {
  return readJson<ProjectSnapshot>(await fetch(apiUrl("/api/project/snapshot"), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  }));
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
  return readJson<{ snapshot: ProjectSnapshot }>(
    await fetch(apiUrl("/api/author/mutate"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(mutation),
    }),
  );
}

export async function fetchAuthorWorkspace(token: string) {
  return readJson<{ revisions: RevisionSummary[]; bookmarks: AuthorBookmark[] }>(
    await fetch(apiUrl("/api/author/workspace"), {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export async function undoLastRevision(token: string, expectedRevision: number) {
  return readJson<{ snapshot: ProjectSnapshot }>(
    await fetch(apiUrl("/api/author/undo"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision }),
    }),
  );
}
