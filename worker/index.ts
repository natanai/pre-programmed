import type { ProjectMutation, ProjectSnapshot } from "../src/game/model";
import { createAuthorToken, isAuthor } from "./auth";
import { collectD1Backup } from "./backup";
import { ensureSchema } from "./db/schema";
import { json, withCors } from "./http";
import { applyMutation, getProjectSnapshot, getWorkspace, undo } from "./projectStore";
import { validateMutationBody } from "./validation";

export type Env = {
  DB: D1Database;
  ADMIN_KEY?: string;
};

async function loginAuthor(request: Request, env: Env) {
  if (!env.ADMIN_KEY) return json({ error: "Author access has not been configured." }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof (body as { key?: unknown }).key !== "string") {
    return json({ error: "Invalid body" }, { status: 400 });
  }
  if ((body as { key: string }).key !== env.ADMIN_KEY) return json({ error: "Unauthorized" }, { status: 401 });
  return json(await createAuthorToken(env.ADMIN_KEY));
}

async function downloadBackup(env: Env) {
  const backup = await collectD1Backup(env.DB);
  const filename = `pre-programmed-backup-${backup.exportedAt.replace(/[:.]/g, "-")}.json`;
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({
      ok: true,
      service: "pre-programmed",
      apiVersion: 1,
      persistence: "d1",
      authorConfigured: Boolean(env.ADMIN_KEY),
    });
  }
  if (url.pathname === "/api/project/snapshot" && request.method === "GET") {
    try {
      return json(await getProjectSnapshot(env.DB));
    } catch (error) {
      console.error("Project snapshot initialization failed.", error);
      return json({ error: "Project has not been initialized." }, { status: 503 });
    }
  }
  if (url.pathname === "/api/project/bootstrap" && request.method === "GET") {
    const snapshot = await getProjectSnapshot(env.DB);
    return json({
      startNode: snapshot.nodes.find((node) => node.id === snapshot.startNodeId),
      revision: snapshot.revision,
    });
  }
  if (url.pathname === "/api/author/login" && request.method === "POST") return loginAuthor(request, env);
  if (url.pathname === "/api/author/check" && request.method === "POST") {
    return (await isAuthor(request, env)) ? new Response(null, { status: 204 }) : json({ error: "Unauthorized" }, { status: 401 });
  }

  const author = await isAuthor(request, env);
  if (!author && url.pathname.startsWith("/api/author/")) return json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema(env.DB);

  if (url.pathname === "/api/author/backup" && request.method === "GET") return downloadBackup(env);
  if (url.pathname === "/api/author/workspace" && request.method === "GET") return json(await getWorkspace(env.DB));

  const legacyNodeMatch = url.pathname.match(/^\/api\/author\/nodes\/([^/]+)$/);
  if (legacyNodeMatch && request.method === "PATCH") {
    const body: { text?: unknown; charactersPerSecond?: unknown } = await request
      .json<{ text?: unknown; charactersPerSecond?: unknown }>()
      .catch(() => ({}));
    const snapshot = await getProjectSnapshot(env.DB);
    const existing = snapshot.nodes.find((node) => node.id === decodeURIComponent(legacyNodeMatch[1]));
    if (!existing) return json({ error: "Node not found" }, { status: 404 });
    if (typeof body.text !== "string" || body.text.length > 10_000) {
      return json({ error: "text must be a string no longer than 10,000 characters" }, { status: 400 });
    }
    const charactersPerSecond = typeof body.charactersPerSecond === "number"
      ? Math.round(body.charactersPerSecond)
      : existing.performance.charactersPerSecond;
    if (charactersPerSecond < 1 || charactersPerSecond > 120) {
      return json({ error: "charactersPerSecond must be between 1 and 120" }, { status: 400 });
    }
    const response = await applyMutation(env.DB, {
      expectedRevision: snapshot.revision,
      description: `Changed node #${existing.nodeNumber}`,
      operations: [{
        type: "node.upsert",
        node: {
          ...existing,
          text: body.text,
          performance: { ...existing.performance, charactersPerSecond },
        },
      }],
    });
    if (!response.ok) return response;
    const result = await response.json<{ snapshot: ProjectSnapshot }>();
    const node = result.snapshot.nodes.find((candidate) => candidate.id === existing.id);
    return json({ node, revision: result.snapshot.revision });
  }

  if (url.pathname === "/api/author/mutate" && request.method === "POST") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const error = validateMutationBody(body);
    if (error) return json({ error }, { status: 400 });
    return applyMutation(env.DB, body as ProjectMutation);
  }

  if (url.pathname === "/api/author/undo" && request.method === "POST") {
    const body: { expectedRevision?: number } = await request.json<{ expectedRevision?: number }>().catch(() => ({}));
    if (!Number.isInteger(body.expectedRevision)) return json({ error: "Invalid expectedRevision." }, { status: 400 });
    return undo(env.DB, body.expectedRevision!);
  }

  return json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return new Response("Pre-Programmed API", { status: 404 });
    return withCors(request, await handleApi(request, env));
  },
} satisfies ExportedHandler<Env>;
