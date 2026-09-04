import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { once } from "node:events";

const dataDirectory = ".wrangler/local-verification";
const origin = "http://127.0.0.1:5173";
const acceptanceContentKey = "local_media_acceptance_01";
const acceptanceAssetId = "local-media-acceptance";
const acceptanceContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect data-vector-cell="0" x="0" y="0" width="1" height="1" fill="#ffffff"/></svg>';
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

async function mutate(snapshot, token, operations, description) {
  const response = await fetch(`${origin}/api/author/mutate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expectedRevision: snapshot.revision,
      description,
      operations,
    }),
  });
  if (!response.ok) throw new Error(`Local mutation failed (${response.status}): ${await response.text()}`);
  const body = await response.json();
  if (!body?.snapshot || body.snapshot.revision <= snapshot.revision) {
    throw new Error("Local mutation did not advance the project revision.");
  }
  return body.snapshot;
}

async function readAcceptanceMedia() {
  const response = await fetch(`${origin}/api/media/content/${acceptanceContentKey}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Local SVG read failed (${response.status}): ${await response.text()}`);
  const content = await response.text();
  if (content !== acceptanceContent) throw new Error("Local SVG content changed unexpectedly.");
  if (!response.headers.get("content-type")?.startsWith("image/svg+xml")) throw new Error("Local SVG content type changed unexpectedly.");
}

function mediaHealthIsCurrent(health) {
  return health?.ok === true
    && health?.persistence === "d1"
    && health?.mediaGeneratedPersistence === "d1"
    && health?.mediaFilePersistence === "repository"
    && health?.authorConfigured === true;
}

try {
  await rm(dataDirectory, { recursive: true, force: true });

  startRuntime();
  await waitForJson("/api/health", mediaHealthIsCurrent);
  const initial = await waitForJson("/api/project/snapshot", (snapshot) =>
    Array.isArray(snapshot?.nodes)
    && snapshot.nodes.length > 0
    && typeof snapshot?.startNodeId === "string"
    && Number.isInteger(snapshot?.revision));
  const token = await login();

  const withMedia = await mutate(initial, token, [{
    type: "mediaAsset.upsert",
    asset: {
      id: acceptanceAssetId,
      name: "local-acceptance.svg",
      kind: "image",
      mimeType: "image/svg+xml",
      contentKey: acceptanceContentKey,
      byteLength: new TextEncoder().encode(acceptanceContent).byteLength,
      intrinsicWidth: 32,
      intrinsicHeight: 32,
      defaultPresentation: "inline",
      authoringMode: "vector-grid",
    },
    generatedContent: {
      mimeType: "image/svg+xml",
      text: acceptanceContent,
    },
  }], "Local atomic D1 SVG media persistence acceptance");
  await readAcceptanceMedia();

  const saved = await mutate(withMedia, token, [
    { type: "project.settings", settings: withMedia.settings },
  ], "Local D1 persistence acceptance");
  await stopRuntime();

  startRuntime();
  await waitForJson("/api/health", mediaHealthIsCurrent);
  const reopened = await waitForJson("/api/project/snapshot", (snapshot) =>
    Array.isArray(snapshot?.nodes)
    && snapshot.revision === saved.revision
    && snapshot.mediaAssets?.some((asset) => asset.id === acceptanceAssetId && asset.contentKey === acceptanceContentKey));
  if (reopened.startNodeId !== saved.startNodeId) throw new Error("Reopened local project changed identity unexpectedly.");
  await readAcceptanceMedia();

  console.log(`Local runtime acceptance passed at revision ${reopened.revision} with atomic D1-generated SVG Media, persistent project state, and repository-backed file Media.`);
} finally {
  await stopRuntime();
  await rm(dataDirectory, { recursive: true, force: true });
}