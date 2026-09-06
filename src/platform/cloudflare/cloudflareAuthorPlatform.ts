import type { AuthorPlatform, AuthorWorkspaceSnapshot } from "../author/authorPlatform";
import type { AuthorBookmark, ProjectSnapshot } from "../../engine/project/model";
import { ApiError, apiUrl, readJson } from "./http";

function filenameFrom(response: Response, fallback: string) {
  return response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

async function download(response: Response, fallbackFilename: string) {
  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(response.status, detail || `Download failed (${response.status}).`);
  }
  return {
    blob: await response.blob(),
    filename: filenameFrom(response, fallbackFilename),
  };
}

export const cloudflareAuthorPlatform: AuthorPlatform = {
  async checkSession(authorization) {
    const response = await fetch(apiUrl("/api/author/check"), {
      method: "POST",
      headers: { Authorization: `Bearer ${authorization}` },
    });
    return response.ok;
  },

  async login(key) {
    const result = await readJson<{ token: string }>(await fetch(apiUrl("/api/author/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    }));
    return result.token;
  },

  async downloadBackup(authorization) {
    return download(await fetch(apiUrl("/api/author/backup"), {
      headers: { Authorization: `Bearer ${authorization}` },
    }), `pre-programmed-backup-${Date.now()}.json`);
  },

  async downloadProject(authorization) {
    return download(await fetch(apiUrl("/api/author/project/export"), {
      headers: { Authorization: `Bearer ${authorization}` },
    }), `pre-programmed-project-${Date.now()}.ppgame`);
  },

  async importProject(authorization, file) {
    const response = await fetch(apiUrl("/api/author/project/import"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authorization}`,
        "Content-Type": "application/json",
      },
      body: await file.text(),
    });
    return (await readJson<{ snapshot: ProjectSnapshot }>(response)).snapshot;
  },

  async readWorkspace(authorization) {
    return readJson<AuthorWorkspaceSnapshot>(await fetch(apiUrl("/api/author/workspace"), {
      headers: { Authorization: `Bearer ${authorization}` },
    }));
  },

  async saveRunBookmark(authorization, bookmark) {
    const result = await readJson<{ bookmark: AuthorBookmark }>(await fetch(apiUrl("/api/author/run-bookmarks"), {
      method: "POST",
      headers: { Authorization: `Bearer ${authorization}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bookmark }),
    }));
    return result.bookmark;
  },

  async deleteRunBookmark(authorization, id) {
    await readJson<{ ok: boolean }>(await fetch(apiUrl(`/api/author/run-bookmarks/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authorization}` },
    }));
  },

  async undoLastRevision(authorization, expectedRevision) {
    const result = await readJson<{ snapshot: ProjectSnapshot }>(await fetch(apiUrl("/api/author/undo"), {
      method: "POST",
      headers: { Authorization: `Bearer ${authorization}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision }),
    }));
    return result.snapshot;
  },
};
