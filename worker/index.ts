import { ensureSchema } from "./db/migrations";

type Env = {
  DB: D1Database;
  ADMIN_KEY?: string;
};

type NodeRow = {
  id: string;
  node_number: number;
  text: string;
  characters_per_second: number;
};

type SchemaRow = {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
};

const ALLOWED_ORIGINS = new Set([
  "https://natanai.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const AUTHOR_SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function withCors(request: Request, response: Response) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
  headers.set("access-control-allow-headers", "Authorization, Content-Type");
  headers.append("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getSigningKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createAuthorToken(secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + AUTHOR_SESSION_SECONDS;
  const payload = `author.${expiresAt}`;
  const key = await getSigningKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return {
    token: `${expiresAt}.${base64Url(signature)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

async function isAuthor(request: Request, env: Env) {
  if (!env.ADMIN_KEY) return false;
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const token = header.slice("Bearer ".length);
  const [expiresRaw, signatureRaw, extra] = token.split(".");
  if (!expiresRaw || !signatureRaw || extra) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  try {
    const key = await getSigningKey(env.ADMIN_KEY);
    return crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signatureRaw),
      encoder.encode(`author.${expiresAt}`),
    );
  } catch {
    return false;
  }
}

function toGameNode(row: NodeRow) {
  return {
    id: row.id,
    nodeNumber: row.node_number,
    text: row.text,
    performance: {
      charactersPerSecond: row.characters_per_second,
    },
  };
}

async function getBootstrap(env: Env) {
  await ensureSchema(env.DB);

  const row = await env.DB.prepare(
    `SELECT n.id, n.node_number, n.text, n.characters_per_second
       FROM project_meta p
       JOIN nodes n ON n.id = p.start_node_id
      WHERE p.id = 1`,
  ).first<NodeRow>();

  if (!row) {
    return json({ error: "Project has not been initialized." }, { status: 503 });
  }

  const revisionRow = await env.DB.prepare(
    "SELECT COALESCE(MAX(revision), 0) AS revision FROM revisions",
  ).first<{ revision: number }>();

  return json({
    startNode: toGameNode(row),
    revision: revisionRow?.revision ?? 0,
  });
}

async function loginAuthor(request: Request, env: Env) {
  if (!env.ADMIN_KEY) {
    return json({ error: "Author access has not been configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof (body as { key?: unknown }).key !== "string") {
    return json({ error: "Invalid body" }, { status: 400 });
  }

  if ((body as { key: string }).key !== env.ADMIN_KEY) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  return json(await createAuthorToken(env.ADMIN_KEY));
}

async function updateNode(request: Request, env: Env, id: string) {
  if (!(await isAuthor(request, env))) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema(env.DB);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Invalid body" }, { status: 400 });
  }

  const candidate = body as {
    text?: unknown;
    charactersPerSecond?: unknown;
  };

  if (typeof candidate.text !== "string" || candidate.text.length > 10000) {
    return json({ error: "text must be a string no longer than 10,000 characters" }, { status: 400 });
  }

  const charactersPerSecond =
    typeof candidate.charactersPerSecond === "number"
      ? Math.round(candidate.charactersPerSecond)
      : undefined;

  if (
    charactersPerSecond !== undefined &&
    (!Number.isFinite(charactersPerSecond) || charactersPerSecond < 1 || charactersPerSecond > 120)
  ) {
    return json({ error: "charactersPerSecond must be between 1 and 120" }, { status: 400 });
  }

  const existing = await env.DB.prepare(
    "SELECT id, node_number, text, characters_per_second FROM nodes WHERE id = ?",
  )
    .bind(id)
    .first<NodeRow>();

  if (!existing) {
    return json({ error: "Node not found" }, { status: 404 });
  }

  const nextCps = charactersPerSecond ?? existing.characters_per_second;

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE nodes
          SET text = ?, characters_per_second = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
    ).bind(candidate.text, nextCps, id),
    env.DB.prepare(
      "INSERT INTO revisions (kind, entity_id, payload) VALUES (?, ?, ?)",
    ).bind(
      "node.update",
      id,
      JSON.stringify({
        before: {
          text: existing.text,
          charactersPerSecond: existing.characters_per_second,
        },
        after: {
          text: candidate.text,
          charactersPerSecond: nextCps,
        },
      }),
    ),
  ]);

  const updated = await env.DB.prepare(
    "SELECT id, node_number, text, characters_per_second FROM nodes WHERE id = ?",
  )
    .bind(id)
    .first<NodeRow>();

  const revisionRow = await env.DB.prepare(
    "SELECT COALESCE(MAX(revision), 0) AS revision FROM revisions",
  ).first<{ revision: number }>();

  return json({
    node: updated ? toGameNode(updated) : toGameNode(existing),
    revision: revisionRow?.revision ?? 0,
  });
}

function quoteIdentifier(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

async function downloadBackup(request: Request, env: Env) {
  if (!(await isAuthor(request, env))) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema(env.DB);

  const schemaResult = await env.DB.prepare(
    `SELECT type, name, tbl_name, sql
       FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
      ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`,
  ).all<SchemaRow>();

  const tables: Record<string, unknown[]> = {};
  for (const entry of schemaResult.results) {
    if (entry.type !== "table") continue;
    const rows = await env.DB.prepare(`SELECT * FROM ${quoteIdentifier(entry.name)}`).all();
    tables[entry.name] = rows.results;
  }

  const exportedAt = new Date().toISOString();
  const body = JSON.stringify(
    {
      format: "pre-programmed-d1-backup",
      version: 1,
      exportedAt,
      schema: schemaResult.results,
      tables,
    },
    null,
    2,
  );
  const filename = `pre-programmed-backup-${exportedAt.replace(/[:.]/g, "-")}.json`;

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true, service: "pre-programmed" });
  }

  if (url.pathname === "/api/project/bootstrap" && request.method === "GET") {
    return getBootstrap(env);
  }

  if (url.pathname === "/api/author/login" && request.method === "POST") {
    return loginAuthor(request, env);
  }

  if (url.pathname === "/api/author/check" && request.method === "POST") {
    return (await isAuthor(request, env))
      ? new Response(null, { status: 204 })
      : json({ error: "Unauthorized" }, { status: 401 });
  }

  if (url.pathname === "/api/author/backup" && request.method === "GET") {
    return downloadBackup(request, env);
  }

  const nodeMatch = url.pathname.match(/^\/api\/author\/nodes\/([^/]+)$/);
  if (nodeMatch && request.method === "PATCH") {
    return updateNode(request, env, decodeURIComponent(nodeMatch[1]));
  }

  return json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return new Response("Pre-Programmed API", { status: 404 });
    }
    return withCors(request, await handleApi(request, env));
  },
} satisfies ExportedHandler<Env>;
