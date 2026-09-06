# Install Pre-Programmed as a New Game Engine Instance

The supported goal is:

> fork or clone → connect the installation's own persistence/runtime → enter Author mode → build the game without ordinary engine-source edits

Cloudflare Worker/D1 support is bundled for hosted installations. Local-only use does not require a Cloudflare account. Ordinary file Media is version-controlled with the game rather than requiring a separate blob-storage service.

## Fastest hosted path: GitHub fork + Cloudflare

A normal GitHub fork no longer needs a local bootstrap deployment or a copied D1 UUID.

1. Fork the repository.
2. In the fork's GitHub Actions secrets, add:

```text
ADMIN_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

3. Make sure the Cloudflare API token can deploy Workers and has D1 read/write access.
4. Enable GitHub Pages with GitHub Actions as the source if the repository has not used Pages before.
5. Run the included **Deploy production** workflow, or push a deployable change to `main`.

For a fresh installation, the workflow derives the Worker and D1 names from the fork's repository name, finds the installation's D1 database by that name, and creates it when it does not yet exist. It then deploys the Worker, captures that installation's Worker URL, builds the client for the fork's GitHub Pages origin, verifies the initialized project, and publishes the client.

No upstream Worker URL, D1 UUID, repository owner, or authored project data is required.

Optional GitHub repository variables can override the derived installation names/origins:

```text
PRE_PROGRAMMED_WORKER_NAME
PRE_PROGRAMMED_D1_DATABASE_NAME
PRE_PROGRAMMED_D1_DATABASE_ID
PRE_PROGRAMMED_API_ORIGIN
PRE_PROGRAMMED_CLIENT_ORIGIN
```

`PRE_PROGRAMMED_D1_DATABASE_ID` is primarily an escape hatch for unusual installations. Ordinary fresh forks should not need it.

## Local/manual installation setup

If you want to prepare an installation locally, install dependencies:

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

### Manual Cloudflare provisioning

If you are deploying from your own machine rather than using the included GitHub workflow, authenticate Wrangler and create the D1 database selected during setup:

```sh
npx wrangler d1 create YOUR_DATABASE_NAME --binding DB --update-config
```

Then configure the Worker secret:

```text
ADMIN_KEY
```

and deploy:

```sh
npx wrangler deploy
```

D1 stores mutable project data, synth definitions, and generated textual Media content such as Author-created SVG. The Worker initializes the current schema through the canonical migration system. Do not hand-edit D1 tables for normal installation.

## File Media

Audio, conventional images, and other file Media belong under:

```text
public/assets/
```

A bare supported file is enough. For example:

```text
public/assets/audio/door-creak.ogg
```

`npm run generate:assets` scans the assets folder and derives the file's MIME type, dimensions where available, byte length, hash, and runtime path. If there is no neighboring identity receipt, the scanner gives the file a deterministic stable Media ID from its relative path:

```text
repo:/assets/audio/door-creak.ogg
```

When the assets folder is writable, the scanner also creates this identity receipt automatically:

```text
public/assets/audio/door-creak.ogg.asset.json
```

```json
{
  "id": "repo:/assets/audio/door-creak.ogg"
}
```

The `.asset.json` file is therefore **not setup that an author must create**. It is an engine-owned identity receipt. Keep it with the file when moving or renaming that file if you want existing authored references to keep the same ID. If a build environment is read-only or ephemeral, the build still uses the same deterministic path-derived ID even if it cannot persist the receipt.

The production build runs asset generation automatically. The Windows portable runtime uses the same scanner against the visible `assets/` folder beside the executable, so dropping the same bare file into either distribution follows the same identity rules.

Authored rules reference stable Media IDs rather than file URLs. File facts stay derived from the file itself, while author-editable name, presentation, and vector-grid editor identity stay in Media project data and travel with `.ppgame`. Older sidecars containing those fields remain readable as migration defaults; new engine-generated and exported receipts contain only `id`.

Synths and the small SVG/vector tools created inside Author mode do **not** need repository files: their authored definitions/content remain D1-backed. If an Author-created vector SVG is exported into file Media, its stable ID receipt preserves the file identity while its vector-grid editability remains part of project Media metadata.

## API and client origins

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

The Worker CORS origin is installation-owned as well. Standard GitHub Pages installs derive it from the fork owner; custom hosting can set:

```text
PRE_PROGRAMMED_CLIENT_ORIGIN
```

The Pages base path is derived from the repository name for the standard setup. `VITE_BASE_PATH` remains available for nonstandard hosting.

## Production workflow

The included production workflow runs on pushes to `main` that affect deployable source/configuration. Documentation-only and test-only changes do not trigger production deployment.

Required GitHub configuration:

```text
Secrets:
ADMIN_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The Cloudflare API token must be able to deploy Workers and list/create D1 databases. The D1 create API requires D1 Write permission.

The workflow:

1. installs dependencies and generates repository Media metadata;
2. resolves this installation's Worker, client origin, and D1 database;
3. reuses the existing D1 binding when one is already deployed, otherwise finds the D1 database by installation name and creates it if absent;
4. deploys the Worker and captures its reported deployment URL;
5. builds the client against that installation-specific API URL, unless a custom API override is configured;
6. verifies the selected API, initialized project, and Media persistence contract;
7. publishes GitHub Pages.

There is no binary object-store setup step. File Media ships with the repository and generated Media stays in D1.

## Run locally with no Cloudflare account

```sh
npm run local
```

Local mode uses the same Worker/schema/runtime with local D1 state. Repository Media is served by the local client build.

See [`local-runtime.md`](local-runtime.md) for details.

To verify persistence across a complete local restart:

```sh
npm run verify:local
```

## Move a game between installations

Author mode's **PROJECT FILE** task exports authored project state to one `.ppgame` file and imports it through the same feature-owned restore contracts used by the engine.

That makes the same project portable between, for example:

- a Windows portable build;
- a local repository checkout;
- a newly forked Cloudflare/GitHub Pages installation.

Ordinary image/audio files remain repository/external Media and should accompany the project separately. Bare files work at their original relative paths; when a file has an identity receipt, move that receipt with it so the same stable ID survives path changes.

Project-file import is a forward-migration boundary for deliberate engine releases; it is not a promise to keep removed legacy feature implementations running forever.

## Verify an installation

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
6. a bare repository image/audio file can be selected after asset generation without a hand-authored sidecar, and a generated identity receipt can preserve that Media ID when the file is later moved.

## What belongs to an installation

Installation-specific state includes:

- runtime/Worker identity;
- database configuration;
- Author key;
- hosted API origin;
- client/CORS origin;
- hosting/base-path configuration;
- repository Media files and any engine-generated identity receipts that accompany them.

These details are platform configuration or game content, not feature behavior. A developer should be able to replace platform adapters without rewriting authored game references or feature logic.
