function required(value, label) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required to prepare Media storage.`);
  return normalized;
}

function cloudflareErrors(payload, fallback) {
  const messages = Array.isArray(payload?.errors)
    ? payload.errors.map((error) => error?.message).filter(Boolean)
    : [];
  return messages.length ? messages.join("; ") : fallback;
}

const accountId = required(process.env.CLOUDFLARE_ACCOUNT_ID, "CLOUDFLARE_ACCOUNT_ID");
const apiToken = required(process.env.CLOUDFLARE_API_TOKEN, "CLOUDFLARE_API_TOKEN");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1)?.trim() || "";
const workerName = required(process.env.PRE_PROGRAMMED_WORKER_NAME || repositoryName, "PRE_PROGRAMMED_WORKER_NAME");
const bucketName = required(process.env.PRE_PROGRAMMED_ASSET_BUCKET_NAME || `${workerName}-assets`, "PRE_PROGRAMMED_ASSET_BUCKET_NAME");
const root = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/r2/buckets`;
const headers = { Authorization: `Bearer ${apiToken}` };

const existing = await fetch(`${root}/${encodeURIComponent(bucketName)}`, { headers });
if (existing.ok) {
  const payload = await existing.json();
  if (payload?.success !== true) throw new Error(cloudflareErrors(payload, `Could not verify R2 bucket ${bucketName}.`));
  console.log(`Media R2 bucket ${bucketName} already exists.`);
  process.exit(0);
}

if (existing.status !== 404) {
  const payload = await existing.json().catch(() => null);
  throw new Error(cloudflareErrors(
    payload,
    `Could not inspect R2 bucket ${bucketName} (${existing.status}). Verify CLOUDFLARE_API_TOKEN has R2 access.`,
  ));
}

const created = await fetch(root, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ name: bucketName }),
});
const payload = await created.json().catch(() => null);
if (!created.ok || payload?.success !== true) {
  throw new Error(cloudflareErrors(
    payload,
    `Could not create R2 bucket ${bucketName} (${created.status}). The deployment token needs Workers R2 Storage Write permission.`,
  ));
}
console.log(`Created Media R2 bucket ${bucketName}.`);
