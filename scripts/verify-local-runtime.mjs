import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { once } from "node:events";

const dataDirectory = ".wrangler/local-verification";
const origin = "http://127.0.0.1:5173";
let runtime = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(path, predicate, attempts = 40) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${origin}${path}`, { cache: "no-store" });
      const value = await response.json();
      if (response.ok && predicate(value)) return value;
      lastError = new Error(`${path} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError ?? new Error(`Timed out waiting for ${path}`);
}

function startRuntime() {
  const child = spawn(process.execPath, ["scripts/run-local.mjs"], {
    stdio: "inherit",
    env: {
      ...process.env,
      PRE_PROGRAMMED_LOCAL_DATA_DIR: dataDirectory,
    },
  });
  runtime = child;
  return child;
}

async function stopRuntime() {
  const child = runtime;
  runtime = null;
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    sleep(3000),
  ]);
  await sleep(1000);
}

async function login() {
  const response = await fetch(`${origin}/api/author/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "local" }),
  });
  if (!response.ok) throw new Error(`Local Author login failed (${response.status}).`);
  const body = await response.json();
  if (typeof body?.token !== "string" || !body.token) throw new Error("Local Author login returned no token.");
  return body.token;
}

async function saveNoopSettingsMutation(snapshot, token) {
  const response = await fetch(`${origin}/api/author/mutate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expectedRevision: snapshot.revision,
      description: "Local runtime persistence acceptance",
      operations: [{ type: "project.settings", settings: snapshot.settings }],
    }),
  });
  if (!response.ok) throw new Error(`Local mutation failed (${response.status}): ${await response.text()}`);
  const body = await response.json();
  if (!body?.snapshot || body.snapshot.revision <= snapshot.revision) {
    throw new Error("Local mutation did not advance the project revision.");
  }
  return body.snapshot;
}

try {
  await rm(dataDirectory, { recursive: true, force: true });

  startRuntime();
  await waitForJson("/api/health", (health) =>
    health?.ok === true
    && health?.persistence === "d1"
    && health?.authorConfigured === true);
  const initial = await waitForJson("/api/project/snapshot", (snapshot) =>
    Array.isArray(snapshot?.nodes)
    && snapshot.nodes.length > 0
    && typeof snapshot?.startNodeId === "string"
    && Number.isInteger(snapshot?.revision));
  const token = await login();
  const saved = await saveNoopSettingsMutation(initial, token);
  await stopRuntime();

  startRuntime();
  const reopened = await waitForJson("/api/project/snapshot", (snapshot) =>
    Array.isArray(snapshot?.nodes)
    && snapshot.revision === saved.revision);
  if (reopened.startNodeId !== saved.startNodeId) throw new Error("Reopened local project changed identity unexpectedly.");

  console.log(`Local runtime acceptance passed at revision ${reopened.revision}.`);
} finally {
  await stopRuntime();
  await rm(dataDirectory, { recursive: true, force: true });
}
