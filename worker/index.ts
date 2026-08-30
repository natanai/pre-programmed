type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
  ADMIN_KEY?: string;
};

type NodeRow = {
  id: string;
  node_number: number;
  text: string;
  characters_per_second: number;
};

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function isAuthor(request: Request, env: Env) {
  if (!env.ADMIN_KEY) return false;
  return request.headers.get("authorization") === `Bearer ${env.ADMIN_KEY}`;
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

async function updateNode(request: Request, env: Env, id: string) {
  if (!isAuthor(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "pre-programmed" });
    }

    if (url.pathname === "/api/project/bootstrap" && request.method === "GET") {
      return getBootstrap(env);
    }

    if (url.pathname === "/api/author/check" && request.method === "POST") {
      return isAuthor(request, env)
        ? new Response(null, { status: 204 })
        : json({ error: "Unauthorized" }, { status: 401 });
    }

    const nodeMatch = url.pathname.match(/^\/api\/author\/nodes\/([^/]+)$/);
    if (nodeMatch && request.method === "PATCH") {
      return updateNode(request, env, decodeURIComponent(nodeMatch[1]));
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
