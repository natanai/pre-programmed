import { readFile, writeFile } from "node:fs/promises";

const outputPath = process.argv[2] || ".wrangler.deploy.jsonc";
const templatePath = new URL("../wrangler.template.jsonc", import.meta.url);

function required(value, label) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required for deployment configuration.`);
  return normalized;
}

async function recoverD1DatabaseId({ accountId, apiToken, workerName }) {
  const root = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(workerName)}/versions`;
  const headers = { Authorization: `Bearer ${apiToken}` };

  const listResponse = await fetch(`${root}?per_page=10`, { headers });
  if (!listResponse.ok) {
    throw new Error(`Could not read deployed Worker versions (${listResponse.status}). Set PRE_PROGRAMMED_D1_DATABASE_ID explicitly or verify Workers Scripts read access.`);
  }
  const listPayload = await listResponse.json();
  const versions = Array.isArray(listPayload?.result?.items) ? listPayload.result.items : [];
  const versionId = versions.find((version) => typeof version?.id === "string")?.id;
  if (!versionId) {
    throw new Error("No deployed Worker version is available to recover the DB binding. Deploy this installation once with its local Wrangler config or set PRE_PROGRAMMED_D1_DATABASE_ID explicitly.");
  }

  const detailResponse = await fetch(`${root}/${encodeURIComponent(versionId)}`, { headers });
  if (!detailResponse.ok) {
    throw new Error(`Could not read deployed Worker version detail (${detailResponse.status}). Set PRE_PROGRAMMED_D1_DATABASE_ID explicitly or verify Workers Scripts read access.`);
  }
  const detailPayload = await detailResponse.json();
  const bindings = detailPayload?.result?.resources?.bindings ?? [];
  const binding = bindings.find((candidate) =>
    candidate?.type === "d1"
    && candidate?.name === "DB"
    && typeof candidate?.database_id === "string"
  );
  if (!binding) {
    throw new Error("The deployed Worker does not expose a DB D1 binding that can be recovered for deployment.");
  }
  return binding.database_id;
}

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1)?.trim() || "";
const workerName = required(process.env.PRE_PROGRAMMED_WORKER_NAME || repositoryName, "PRE_PROGRAMMED_WORKER_NAME");
const databaseName = required(process.env.PRE_PROGRAMMED_D1_DATABASE_NAME || `${workerName}-db`, "PRE_PROGRAMMED_D1_DATABASE_NAME");
let databaseId = process.env.PRE_PROGRAMMED_D1_DATABASE_ID?.trim() || "";

if (!databaseId) {
  databaseId = await recoverD1DatabaseId({
    accountId: required(process.env.CLOUDFLARE_ACCOUNT_ID, "CLOUDFLARE_ACCOUNT_ID"),
    apiToken: required(process.env.CLOUDFLARE_API_TOKEN, "CLOUDFLARE_API_TOKEN"),
    workerName,
  });
}

const template = JSON.parse(await readFile(templatePath, "utf8"));
template.name = workerName;
template.d1_databases = [{
  binding: "DB",
  database_name: databaseName,
  database_id: databaseId,
}];

await writeFile(outputPath, `${JSON.stringify(template, null, 2)}\n`, { mode: 0o600 });
console.log(`Prepared deployment Wrangler config for ${workerName} with DB binding ${databaseName}.`);
