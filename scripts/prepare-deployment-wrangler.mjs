import { readFile, writeFile } from "node:fs/promises";

const outputPath = process.argv[2] || ".wrangler.deploy.jsonc";
const templatePath = new URL("../wrangler.template.jsonc", import.meta.url);

function required(value, label) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required for deployment configuration.`);
  return normalized;
}

function bearerHeaders(apiToken, includeJson = false) {
  return {
    Authorization: `Bearer ${apiToken}`,
    ...(includeJson ? { "content-type": "application/json" } : {}),
  };
}

async function readCloudflareJson(response, label) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const messages = [
      ...(Array.isArray(payload?.errors) ? payload.errors : []),
      ...(Array.isArray(payload?.messages) ? payload.messages : []),
    ].map((entry) => entry?.message).filter(Boolean);
    throw new Error(`${label} (${response.status})${messages.length ? `: ${messages.join("; ")}` : ""}`);
  }
  return payload;
}

async function recoverExistingD1DatabaseId({ accountId, apiToken, workerName }) {
  const root = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(workerName)}/versions`;
  const headers = bearerHeaders(apiToken);

  const listResponse = await fetch(`${root}?per_page=10`, { headers });
  if (listResponse.status === 404) {
    return { workerExists: false, databaseId: "" };
  }
  const listPayload = await readCloudflareJson(
    listResponse,
    `Could not read deployed Worker versions for ${workerName}. Existing installation storage will not be replaced automatically`,
  );
  const versions = Array.isArray(listPayload?.result?.items) ? listPayload.result.items : [];
  const versionId = versions.find((version) => typeof version?.id === "string")?.id;
  if (!versionId) {
    throw new Error(
      `Worker ${workerName} exists but no deployed version is available to recover its DB binding. Set PRE_PROGRAMMED_D1_DATABASE_ID explicitly rather than creating replacement storage.`,
    );
  }

  const detailResponse = await fetch(`${root}/${encodeURIComponent(versionId)}`, { headers });
  const detailPayload = await readCloudflareJson(
    detailResponse,
    `Could not read deployed Worker version detail for ${workerName}. Existing installation storage will not be replaced automatically`,
  );
  const bindings = detailPayload?.result?.resources?.bindings ?? [];
  const binding = bindings.find((candidate) =>
    candidate?.type === "d1"
    && candidate?.name === "DB"
    && typeof candidate?.database_id === "string"
  );
  if (!binding) {
    throw new Error(
      `Worker ${workerName} already exists but its deployed version has no recoverable DB D1 binding. Set PRE_PROGRAMMED_D1_DATABASE_ID explicitly rather than creating replacement storage.`,
    );
  }
  return { workerExists: true, databaseId: binding.database_id };
}

async function findD1DatabaseId({ accountId, apiToken, databaseName }) {
  const root = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database`;
  const response = await fetch(`${root}?name=${encodeURIComponent(databaseName)}&per_page=100`, {
    headers: bearerHeaders(apiToken),
  });
  const payload = await readCloudflareJson(response, `Could not list D1 databases while looking for ${databaseName}`);
  const databases = Array.isArray(payload?.result) ? payload.result : [];
  const exact = databases.find((database) => database?.name === databaseName && typeof database?.uuid === "string");
  return exact?.uuid ?? "";
}

async function ensureD1DatabaseId({ accountId, apiToken, databaseName }) {
  const existingId = await findD1DatabaseId({ accountId, apiToken, databaseName });
  if (existingId) {
    console.log(`Using existing D1 database ${databaseName}.`);
    return existingId;
  }

  const root = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database`;
  const response = await fetch(root, {
    method: "POST",
    headers: bearerHeaders(apiToken, true),
    body: JSON.stringify({ name: databaseName }),
  });

  // A parallel first deployment may have created the same installation DB after
  // our initial lookup. Re-read by stable installation name rather than failing
  // or creating a second persistence path.
  if (response.status === 409) {
    const racedId = await findD1DatabaseId({ accountId, apiToken, databaseName });
    if (racedId) return racedId;
  }

  const payload = await readCloudflareJson(response, `Could not create D1 database ${databaseName}`);
  const databaseId = payload?.result?.uuid;
  if (typeof databaseId !== "string" || !databaseId) {
    throw new Error(`Cloudflare created ${databaseName} without returning its D1 UUID.`);
  }
  console.log(`Created D1 database ${databaseName}.`);
  return databaseId;
}

const [repositoryOwner = "", repositoryName = ""] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
const workerName = required(process.env.PRE_PROGRAMMED_WORKER_NAME || repositoryName, "PRE_PROGRAMMED_WORKER_NAME");
const databaseName = required(process.env.PRE_PROGRAMMED_D1_DATABASE_NAME || `${workerName}-db`, "PRE_PROGRAMMED_D1_DATABASE_NAME");
const clientOrigin = required(
  process.env.PRE_PROGRAMMED_CLIENT_ORIGIN || (repositoryOwner ? `https://${repositoryOwner}.github.io` : ""),
  "PRE_PROGRAMMED_CLIENT_ORIGIN",
).replace(/\/+$/, "");
const accountId = required(process.env.CLOUDFLARE_ACCOUNT_ID, "CLOUDFLARE_ACCOUNT_ID");
const apiToken = required(process.env.CLOUDFLARE_API_TOKEN, "CLOUDFLARE_API_TOKEN");
let databaseId = process.env.PRE_PROGRAMMED_D1_DATABASE_ID?.trim() || "";

if (!databaseId) {
  const recovered = await recoverExistingD1DatabaseId({ accountId, apiToken, workerName });
  if (recovered.workerExists) {
    databaseId = recovered.databaseId;
    console.log(`Recovered existing D1 binding for Worker ${workerName}.`);
  } else {
    databaseId = await ensureD1DatabaseId({ accountId, apiToken, databaseName });
  }
}

const template = JSON.parse(await readFile(templatePath, "utf8"));
template.name = workerName;
template.vars = {
  ...(template.vars ?? {}),
  CLIENT_ORIGIN: clientOrigin,
};
template.d1_databases = [{
  binding: "DB",
  database_name: databaseName,
  database_id: databaseId,
}];
delete template.r2_buckets;

await writeFile(outputPath, `${JSON.stringify(template, null, 2)}\n`, { mode: 0o600 });
console.log(`Prepared deployment Wrangler config for ${workerName} with DB ${databaseName} and client origin ${clientOrigin}. File Media is shipped from public/assets.`);
