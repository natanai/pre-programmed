import {
  ProjectRevisionConflictError,
  ProjectWriteRejectedError,
  type ProjectPersistence,
} from "./projectPersistence";
import type { ProjectMutation, ProjectSnapshot } from "../../engine/project/model";
import { normalizeProjectSnapshot } from "../../engine/project/settings";
import { ApiError, apiUrl, readJson } from "../cloudflare/http";

export const cloudflareProjectPersistence: ProjectPersistence = {
  async readProject() {
    const snapshot = await readJson<ProjectSnapshot>(await fetch(apiUrl("/api/project/snapshot"), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }));
    return normalizeProjectSnapshot(snapshot);
  },

  async writeProject(mutation: ProjectMutation, context) {
    if (!context?.authorization) throw new Error("Author authorization is required for the hosted project store.");
    try {
      const result = await readJson<{ snapshot: ProjectSnapshot }>(await fetch(apiUrl("/api/author/mutate"), {
        method: "POST",
        headers: { Authorization: `Bearer ${context.authorization}`, "Content-Type": "application/json" },
        body: JSON.stringify(mutation),
      }));
      return normalizeProjectSnapshot(result.snapshot);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        throw new ProjectRevisionConflictError(error.message);
      }
      if (
        error instanceof ApiError
        && error.status >= 400
        && error.status < 500
        && error.status !== 408
        && error.status !== 429
      ) {
        throw new ProjectWriteRejectedError(error.message);
      }
      throw error;
    }
  },
};
