import type {
  AuthorBookmark,
  ProjectMutation,
  ProjectSnapshot,
  RevisionSummary,
} from "../game/model";

export const API_ORIGIN = "https://pre-programmed.natanai.workers.dev";

export function apiUrl(path: string) {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "terminal.local") {
    return path;
  }
  return `${API_ORIGIN}${path}`;
}

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchProjectSnapshot() {
  return readJson<ProjectSnapshot>(await fetch(apiUrl("/api/project/snapshot")));
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
