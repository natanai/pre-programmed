import type { AuthorPlatform, AuthorWorkspaceSnapshot } from "../author/authorPlatform";
import type { ProjectSnapshot } from "../../engine/project/model";
import { apiUrl, readJson } from "./http";

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

  async readWorkspace(authorization) {
    return readJson<AuthorWorkspaceSnapshot>(await fetch(apiUrl("/api/author/workspace"), {
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
