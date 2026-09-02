# Install Pre-Programmed as a New Game Engine Instance

The supported goal is:

> fork or clone → connect the installation's own persistence/runtime → enter Author mode → build the game without ordinary engine-source edits

Cloudflare Worker/D1 support is bundled for hosted installations. Local-only use does not require a Cloudflare account. Optional binary object storage is not a prerequisite for the engine.

## 1. Fork or clone

Install dependencies:

```sh
npm install
```

For a GitHub fork:

```sh
npm run setup:installation
```

For a direct clone of the upstream repository that should become a distinct installation:

```sh
npm run setup:installation -- --new-installation
```

The explicit flag prevents an upstream checkout from being mistaken for a new installation.

The setup helper prepares installation-local configuration such as:

- Worker name;
- D1 database name;
- optional blob bucket name;
- ignored `wrangler.jsonc`;
- `.env.local` API/base-path values.

It does not create remote Cloudflare resources by itself.

## 2. Create the hosted database

For a Cloudflare-hosted installation, authenticate Wrangler and create the D1 database selected during setup:

```sh
npx wrangler d1 create YOUR_DATABASE_NAME --binding DB --update-config
```

D1 stores mutable project data and supported textual Media content such as Author-created SVG.

## 3. Optional binary blob storage

Binary upload storage is optional.

The bundled Cloudflare adapter can use R2. To enable it, create a bucket and configure the `ASSET_CONTENT` binding through setup or the installation's ignored `wrangler.jsonc`.

```sh
npx wrangler r2 bucket create YOUR_BUCKET_NAME
```

Without a blob provider:

- the engine still deploys and plays;
- text/game authoring works;
- SVG/vector authoring works through D1 text storage;
- repository Media works;
- binary hosted uploads report that blob storage is not configured.

Feature/project data must continue to reference stable Media IDs/content keys rather than provider URLs.

## 4. Configure Author access

Configure the Worker secret:

```text
ADMIN_KEY
```

Then deploy the Worker:

```sh
npx wrangler deploy
```

The Worker initializes the current schema through the canonical migration system. Do not hand-edit D1 tables for normal installation.

## 5. API origin

A hosted client must point to **its own installation's API**. The reusable engine has no upstream-owner fallback.

For ordinary deployment through the included GitHub workflow, you do not need to hard-code a Worker URL. The workflow captures the URL reported by the Worker deployment and injects it into the client build automatically.

For a custom API domain or nonstandard deployment flow, set:

```text
VITE_API_ORIGIN
```

or, for the included GitHub workflow, the optional repository variable:

```text
PRE_PROGRAMMED_API_ORIGIN
```

When that repository variable is present, it overrides the automatically captured Worker target.

The Pages base path is derived from the repository name for the standard setup. `VITE_BASE_PATH` remains available for nonstandard hosting.

## 6. GitHub production deployment

The included production workflow runs on pushes to `main` that affect deployable source/configuration. Documentation-only and test-only changes do not trigger production deployment.

Required GitHub configuration:

```text
Secrets:
ADMIN_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Optional installation overrides:

```text
PRE_PROGRAMMED_WORKER_NAME
PRE_PROGRAMMED_D1_DATABASE_NAME
PRE_PROGRAMMED_D1_DATABASE_ID
PRE_PROGRAMMED_ASSET_BUCKET_NAME
PRE_PROGRAMMED_API_ORIGIN
```

The workflow:

1. installs dependencies and generates repository Media metadata;
2. prepares temporary Worker configuration;
3. deploys the Worker and captures its reported deployment URL;
4. builds the client against that installation-specific API URL, unless a custom API override is configured;
5. verifies the selected API and initialized project;
6. publishes GitHub Pages.

When `PRE_PROGRAMMED_ASSET_BUCKET_NAME` is unset, R2 is not required or bound.

## 7. Run locally with no Cloudflare account

```sh
npm run local
```

Local mode uses the same Worker/schema/runtime with local D1 state and no R2 binding.

See [`local-runtime.md`](local-runtime.md) for details.

To verify persistence across a complete local restart:

```sh
npm run verify:local
```

## 8. Verify an installation

Useful repository checks:

```sh
npm run typecheck
npm test
npm run build
npm run verify
```

A hosted installation should also satisfy:

1. `/api/health` reports healthy project persistence and configured Author readiness as expected;
2. `/api/project/snapshot` returns an initialized project;
3. Author login succeeds with the installation's key;
4. an Author edit survives reload;
5. Author-created SVG content can be saved/fetched without blob storage;
6. if a blob provider is configured, binary hosted content survives redeploy.

## What belongs to an installation

Installation-specific state includes:

- runtime/Worker identity;
- database configuration;
- Author key;
- hosted API origin;
- hosting/base-path configuration;
- optional blob-provider configuration.

These details are platform configuration, not feature behavior. A developer should be able to replace platform adapters without rewriting authored game references or feature logic.
