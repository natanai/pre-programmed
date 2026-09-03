# Install Pre-Programmed as a New Game Engine Instance

The supported goal is:

> fork or clone → connect the installation's own persistence/runtime → enter Author mode → build the game without ordinary engine-source edits

Cloudflare Worker/D1 support is bundled for hosted installations. Local-only use does not require a Cloudflare account. Ordinary file Media is version-controlled with the game rather than requiring a separate blob-storage service.

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
- ignored `wrangler.jsonc`;
- `.env.local` API/base-path values.

It does not create remote Cloudflare resources by itself.

## 2. Create the hosted database

For a Cloudflare-hosted installation, authenticate Wrangler and create the D1 database selected during setup:

```sh
npx wrangler d1 create YOUR_DATABASE_NAME --binding DB --update-config
```

D1 stores mutable project data, synth definitions, and generated textual Media content such as Author-created SVG.

## 3. Add file Media through the repository

Audio, conventional images, and other file Media belong under:

```text
public/assets/
```

Each file should have a neighboring `.asset.json` identity sidecar. For example:

```text
public/assets/audio/door-creak.ogg
public/assets/audio/door-creak.ogg.asset.json
```

```json
{
  "id": "your-stable-media-id",
  "name": "Door creak"
}
```

`npm run generate:assets` indexes these files into the generated Media manifest. The production build runs that step automatically.

Authored rules reference the stable Media ID, never the repository path. This keeps gameplay data portable even when a file is renamed or reorganized.

Synths and the small SVG/vector tools created inside Author mode do **not** need repository files: their authored definitions/content remain D1-backed.

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
PRE_PROGRAMMED_API_ORIGIN
```

The workflow:

1. installs dependencies and generates repository Media metadata;
2. prepares temporary Worker/D1 configuration;
3. deploys the Worker and captures its reported deployment URL;
4. builds the client against that installation-specific API URL, unless a custom API override is configured;
5. verifies the selected API, initialized project, and Media persistence contract;
6. publishes GitHub Pages.

There is no binary object-store setup step. File Media ships with the repository and generated Media stays in D1.

## 7. Run locally with no Cloudflare account

```sh
npm run local
```

Local mode uses the same Worker/schema/runtime with local D1 state. Repository Media is served by the local client build.

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

1. `/api/health` reports `mediaGeneratedPersistence: "d1"` and `mediaFilePersistence: "repository"`;
2. `/api/project/snapshot` returns an initialized project;
3. Author login succeeds with the installation's key;
4. an Author edit survives reload;
5. Author-created SVG content can be saved/fetched through D1;
6. a repository audio file with a stable sidecar ID can be selected by `play sound` and survives redeploy without any database binary upload.

## What belongs to an installation

Installation-specific state includes:

- runtime/Worker identity;
- database configuration;
- Author key;
- hosted API origin;
- hosting/base-path configuration;
- repository Media files and their stable identity sidecars.

These details are platform configuration or game content, not feature behavior. A developer should be able to replace platform adapters without rewriting authored game references or feature logic.
