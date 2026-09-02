function required(value, label) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required to prepare optional blob storage.`);
  return normalized;
}

function cloudflareErrors(payload, fallback) {
  const messages = Array.isArray(payload?.errors)
    ? payload.errors.map((error) => error?.message).filter(Boolean)
    : [];
  return messages.length ? messages.join("; ") : fallback;
}

const bucketName = process.env.PRE_PROGRAMMED_ASSET_BUCKET_NAME?.trim() || "";
if (!bucketName) {
  console.log("No PRE_PROGRAMMED_ASSET_BUCKET_NAME configured; skipping optional R2 blob storage.");
  process.exit(0);
}

const accountId = required(process.env.CLOUDFLARE_ACCOUNT_ID, "CLOUDFLARE_ACCOUNT_ID");
const apiToken = required(process.env.CLOUDFLARE_API_TOKEN, "CLOUDFLARE_API_TOKEN");
const root = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/r2/buckets`;
const headers = { Authorization: `Bearer ${apiToken}` };

const existing = await fetch(`${root}/${encodeURIComponent(bucketName)}`, { headers });
if (existing.ok) {
  const payload = await existing.json();
  if (payload?.success !== true) throw new Error(cloudflareErrors(payload, `Could not verify R2 bucket ${bucketName}.`));
  console.log(`Optional Media R2 bucket ${bucketName} already exists.`);
  process.exit(0);
}

if (existing.status !== 404) {
  const payload = await existing.json().catch(() => null);
  throw new Error(cloudflareErrors(
    payload,
    `Could not inspect optional R2 bucket ${bucketName} (${existing.status}). Verify CLOUDFLARE_API_TOKEN has R2 access, or remove PRE_PROGRAMMED_ASSET_BUCKET_NAME to deploy without R2.`,
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
    `Could not create optional R2 bucket ${bucketName} (${created.status}). Remove PRE_PROGRAMMED_ASSET_BUCKET_NAME to deploy without R2, or grant Workers R2 Storage Write permission.`,
  ));
}
console.log(`Created optional Media R2 bucket ${bucketName}.`);
