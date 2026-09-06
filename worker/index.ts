import type { AuthorBookmark, ProjectMutation } from "../src/engine/project/model";
import { createAuthorToken, isAuthor } from "./auth";
import { collectProjectBackup } from "./backup";
import { ensureSchema } from "./db/schema";
import { json, withCors } from "./http";
import { getMediaContent, mediaContentKey } from "./mediaContent";
import { collectPortableProject, restorePortableProject } from "./portableProject";
import { applyMutation, getProjectSnapshot, getWorkspace, undo } from "./projectStore";
import { deleteRunBookmark, runBookmarkError, saveRunBookmark } from "./runBookmarkStore";
import { validateMutationBody } from "./validation";

export type Env = {
  DB: D1Database;
  ADMIN_KEY?: string;
  CLIENT_ORIGIN?: string;
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
  const backup = await collectProjectBackup(env.DB);
  const filename = `pre-programmed-backup-${backup.exportedAt.replace(/[:.]/g, "-")}.json`;
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

async function downloadPortableProject(env: Env) {
  const project = await collectPortableProject(env.DB);
  const filename = `pre-programmed-project-${project.exportedAt.replace(/[:.]/g, "-")}.ppgame`;
  return new Response(JSON.stringify(project, null, 2), {
    headers: {
      "content-type": "application/vnd.pre-programmed.project+json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

async function importPortableProject(request: Request, env: Env) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Portable project file is not valid JSON." }, { status: 400 });
  }
  try {
    return json({ snapshot: await restorePortableProject(env.DB, body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portable project import failed.";
    return json({ error: message }, { status: 400 });
  }
}

export async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({
      ok: true,
      service: "pre-programmed",
      apiVersion: 2,
      persistence: "d1",
      mediaPersistence: "d1-generated+repository-files",
      mediaGeneratedPersistence: "d1",
      mediaFilePersistence: "repository",
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

  const publicContentKey = mediaContentKey(url.pathname, "/api/media/content/");
  if (publicContentKey && request.method === "GET") {
    await ensureSchema(env.DB);
    return getMediaContent(env.DB, publicContentKey);
  }

  if (url.pathname === "/api/author/login" && request.method === "POST") return loginAuthor(request, env);
  if (url.pathname === "/api/author/check" && request.method === "POST") {
    return (await isAuthor(request, env)) ? new Response(null, { status: 204 }) : json({ error: "Unauthorized" }, { status: 401 });
  }

  const author = await isAuthor(request, env);
  if (!author && url.pathname.startsWith("/api/author/")) return json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema(env.DB);

  if (url.pathname === "/api/author/backup" && request.method === "GET") return downloadBackup(env);
  if (url.pathname === "/api/author/project/export" && request.method === "GET") return downloadPortableProject(env);
  if (url.pathname === "/api/author/project/import" && request.method === "POST") return importPortableProject(request, env);
  if (url.pathname === "/api/author/workspace" && request.method === "GET") return json(await getWorkspace(env.DB));

  if (url.pathname === "/api/author/run-bookmarks" && request.method === "POST") {
    const body: { bookmark?: unknown } = await request.json<{ bookmark?: unknown }>().catch(() => ({}));
    const error = runBookmarkError(body.bookmark);
    if (error) return json({ error }, { status: 400 });
    const bookmark = await saveRunBookmark(env.DB, body.bookmark as AuthorBookmark);
    return json({ bookmark });
  }
  const runBookmarkPrefix = "/api/author/run-bookmarks/";
  if (url.pathname.startsWith(runBookmarkPrefix) && request.method === "DELETE") {
    const id = decodeURIComponent(url.pathname.slice(runBookmarkPrefix.length));
    if (!id) return json({ error: "Run bookmark id is required." }, { status: 400 });
    await deleteRunBookmark(env.DB, id);
    return json({ ok: true });
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
    try {
      return withCors(request, await handleApi(request, env), env.CLIENT_ORIGIN);
    } catch (error) {
      console.error("Unhandled API request failure.", error);
      return withCors(request, json({ error: "Server request failed." }, { status: 500 }), env.CLIENT_ORIGIN);
    }
  },
} satisfies ExportedHandler<Env>;
