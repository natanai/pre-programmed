import type { ProjectPersistence } from "./projectPersistence";
import type { ProjectMutation, ProjectSnapshot } from "../../engine/project/model";
import { apiUrl, readJson } from "../cloudflare/http";

export const cloudflareProjectPersistence: ProjectPersistence = {
  async readProject() {
    return readJson<ProjectSnapshot>(await fetch(apiUrl("/api/project/snapshot"), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }));
  },

  async writeProject(mutation: ProjectMutation, context) {
    if (!context?.authorization) throw new Error("Author authorization is required for the hosted project store.");
    const result = await readJson<{ snapshot: ProjectSnapshot }>(await fetch(apiUrl("/api/author/mutate"), {
      method: "POST",
      headers: { Authorization: `Bearer ${context.authorization}`, "Content-Type": "application/json" },
      body: JSON.stringify(mutation),
    }));
    return result.snapshot;
  },
};
