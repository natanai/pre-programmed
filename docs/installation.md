# Install Pre-Programmed as a New Game Engine Instance

The goal is: **fork/clone → connect persistence → create the game in Author mode.** Ordinary game content should not require editing engine source, and optional platform services must not be prerequisites for running the engine.

The repository does not carry any installation's D1 database UUID or hosted binary Media. `wrangler.jsonc` is local installation state and is intentionally ignored by Git.

## 1. Fork or clone

Install dependencies:

```sh
npm install
```

For a GitHub **fork**:

```sh
npm run setup:installation
```

For a direct **clone of `natanai/pre-programmed`** that should become a separate game installation:

```sh
npm run setup:installation -- --new-installation
```

The explicit flag prevents a direct upstream checkout from being mistaken for a new installation.

The helper prepares:

- a Worker name;
- a D1 database name;
- an optional R2/blob bucket binding only when you choose one;
- a local ignored `wrangler.jsonc`;
- `.env.local` with API/base-path settings;
- a Pages base path inferred from the repository name when possible.

It does **not** create Cloudflare resources by itself.

### Existing-installation safety

Once a checkout has its own D1 configuration, setup refuses to overwrite it by default. Use:

```sh
npm run setup:installation -- --force
```

only when replacing that installation intentionally.

Supported non-interactive variables:

```text
PRE_PROGRAMMED_WORKER_NAME
PRE_PROGRAMMED_D1_DATABASE_NAME
PRE_PROGRAMMED_API_ORIGIN
PRE_PROGRAMMED_REPOSITORY_NAME
PRE_PROGRAMMED_BASE_PATH
PRE_PROGRAMMED_ASSET_BUCKET_NAME   # optional blob storage only
```

## 2. Create the database

Authenticate Wrangler with the Cloudflare account that should own the hosted game, then create the D1 binding printed by setup:

```sh
npx wrangler d1 create YOUR_DATABASE_NAME --binding DB --update-config
```

D1 is sufficient for the engine's mutable project data and for textual/vector Media such as Author-created SVG.

### Media storage model

Game systems reference only stable Media asset IDs. Content location is behind the Media platform boundary.

The default installation can use:

- **D1** — project structure, Media metadata, and textual/vector asset content such as SVG;
- **repository assets** — files under `public/assets` with stable identity sidecars;
- **browser storage** — temporary cache, player-local state, and queued edits only.

A separate blob/object store is **optional**. It is useful for uploaded binary files such as PNG, WebP, WAV, MP3, and similar larger objects, but it is not required to deploy, play, author text content, or create/save SVG vectors.

The included Cloudflare adapter supports R2 when desired. To opt in, set a bucket during setup or add this binding to `wrangler.jsonc`:

```json
{
  "r2_buckets": [
    {
      "binding": "ASSET_CONTENT",
      "bucket_name": "your-game-assets"
    }
  ]
}
```

and create the bucket:

```sh
npx wrangler r2 bucket create YOUR_BUCKET_NAME
```

If `ASSET_CONTENT` is absent, binary upload attempts report that optional blob storage is not configured; the rest of the engine continues to operate.

## 3. Configure Author access and deploy the Worker

Configure:

```text
ADMIN_KEY
```

Then deploy:

```sh
npx wrangler deploy
```

On first use, the Worker initializes its schema through the canonical migration owner. No manual D1 table editing is required.

The first hosted deployment also lets GitHub Actions recover the D1 database ID from the deployed Worker later, so the database UUID does not need to be committed to the reusable engine repository.

## 4. Point the client at the Worker

Set:

```text
VITE_API_ORIGIN
```

For GitHub Pages, use repository variable:

```text
PRE_PROGRAMMED_API_ORIGIN
```

The Pages base path is derived from the repository name automatically. `VITE_BASE_PATH` remains available for nonstandard deployments.

## 5. Optional GitHub production deployment

Required GitHub configuration:

```text
Secrets:
ADMIN_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID

Variable:
PRE_PROGRAMMED_API_ORIGIN
```

Optional installation overrides:

```text
PRE_PROGRAMMED_WORKER_NAME
PRE_PROGRAMMED_D1_DATABASE_NAME
PRE_PROGRAMMED_D1_DATABASE_ID
PRE_PROGRAMMED_ASSET_BUCKET_NAME   # opt in to R2 only
```

The workflow builds the client, prepares a temporary Wrangler config, deploys the Worker, verifies D1/text-Media health and a project snapshot, then publishes Pages.

When `PRE_PROGRAMMED_ASSET_BUCKET_NAME` is **unset**, the workflow does not create, require, or bind R2. When it is explicitly set, the included Cloudflare adapter verifies/creates that optional bucket and adds `ASSET_CONTENT` to the Worker.

For the D1 UUID, the workflow supports two paths:

1. recover the existing Worker's `DB` binding automatically; or
2. use `PRE_PROGRAMMED_D1_DATABASE_ID` for a first Actions-only deployment.

## 6. Run locally without Cloudflare object storage

```sh
npm run local
```

The checked-in local runtime intentionally uses D1 with **no R2 binding**. This proves that optional object storage is not part of the core engine contract.

For persistence acceptance across a local restart:

```sh
npm run verify:local
```

That acceptance creates and retrieves SVG content through D1, restarts the local Worker, and confirms both the project metadata and SVG survive without R2.

Useful checks:

```sh
npm run build
npm run typecheck
npm test
npm run verify
```

## 7. Verify a hosted installation

A base installation should satisfy:

1. `/api/health` reports healthy D1 persistence and `mediaTextPersistence: "d1"`.
2. `mediaBlobPersistence` may legitimately be `"unconfigured"`.
3. `/api/project/snapshot` returns an initialized project.
4. Author login succeeds.
5. Author edits survive reload.
6. An Author-created SVG can be saved, fetched, and exported without R2.
7. If a blob provider is configured, binary file uploads survive redeploy as well.

## Portable Media architecture

A Media asset stores stable identity/metadata and an immutable `contentKey`; it does **not** store a D1 URL, R2 URL, repository path, or browser-local URL.

The content resolver decides where a key lives:

- D1 text storage for supported textual Media such as SVG;
- optional blob storage for binary hosted content;
- repository content when an asset has a source-controlled copy.

This means adding, removing, or replacing a storage provider does not require rewriting narrative cues, inventory references, effects, player saves, or other game data.

D1-backed text content is also included automatically in the canonical database backup because it is ordinary relational installation data. Optional blob-provider objects are included separately when that provider is configured.

## Media migration note

Migration 20 removed the old `data_url`/base64 prototype payload from the metadata table. Migration 21 adds a **separate textual content table** for stable, immutable text assets such as SVG. This does not restore the old data-URL model: references still use asset ID + `contentKey`, and content storage remains behind the platform adapter.

## What belongs to an installation

Installation state includes:

- Worker/runtime identity;
- database configuration;
- Author key;
- hosted API origin;
- Pages/base-path configuration;
- optional blob-provider configuration, if chosen.

Those details are adapters/configuration, not game-engine behavior. A future developer should be able to replace the Cloudflare persistence adapters without changing feature modules or authored project references.
