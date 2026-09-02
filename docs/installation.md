# Install Pre-Programmed as a New Game Engine Instance

The goal is simple: **fork/clone → connect your infrastructure → create the game in Author mode.** Ordinary game content should not require changes to engine source.

The repository does not carry any installation's D1 database UUID or hosted Media content. `wrangler.jsonc` is local installation state and is intentionally ignored by Git.

## 1. Fork or clone

Install dependencies:

```sh
npm install
```

For a GitHub **fork**, run:

```sh
npm run setup:installation
```

For a direct **clone of `natanai/pre-programmed`** that should become a separate game installation, run:

```sh
npm run setup:installation -- --new-installation
```

The explicit flag keeps a direct upstream checkout from being mistaken for a new game installation. An existing checkout of the original production repository therefore cannot silently create replacement local infrastructure.

The helper prepares:

- a Worker name;
- a new D1 database name;
- an R2 Media bucket name;
- a local, ignored `wrangler.jsonc` based on `wrangler.template.jsonc`;
- `.env.local` with client API/base-path settings;
- a Pages base path inferred from the GitHub repository name when possible.

It does **not** create Cloudflare resources by itself.

For normal forks, the default Worker name is the repository name, the default D1 name is `<worker-name>-db`, and the default Media bucket is `<worker-name>-assets`. A direct upstream clone uses a safer `my-...` Worker-name default so it cannot casually collide with the original installation.

### Existing-installation safety

After a checkout has its **own** D1 configuration, setup refuses to overwrite it by default.

Only when replacing an already configured installation intentionally should you use:

```sh
npm run setup:installation -- --force
```

For non-interactive setup, these environment variables are supported:

```text
PRE_PROGRAMMED_WORKER_NAME
PRE_PROGRAMMED_D1_DATABASE_NAME
PRE_PROGRAMMED_ASSET_BUCKET_NAME
PRE_PROGRAMMED_API_ORIGIN
PRE_PROGRAMMED_REPOSITORY_NAME
PRE_PROGRAMMED_BASE_PATH
```

## 2. Create this installation's D1 database and R2 Media bucket

Authenticate Wrangler with the Cloudflare account that should own the game.

The setup helper prints the exact commands for the names you chose. They have this form:

```sh
npx wrangler d1 create YOUR_DATABASE_NAME --binding DB --update-config
npx wrangler r2 bucket create YOUR_MEDIA_BUCKET_NAME
```

`--binding DB` assigns the binding expected by the Worker, and `--update-config` writes the newly created database name and UUID into the local `wrangler.jsonc`. The setup helper has already added the `ASSET_CONTENT` R2 binding to that local config.

After D1 creation succeeds, the local configuration should contain the installation's database identity and Media binding. Do not copy another installation's database ID or bucket name unless sharing that infrastructure is intentional.

D1 and R2 have deliberately different responsibilities:

- **D1** stores project structure and Media metadata, including stable asset IDs and immutable `contentKey` references.
- **R2** stores uploaded or Author-created Media bytes.
- **Repository assets** under `public/assets` remain deployable content and carry `.asset.json` sidecars that preserve stable identity independently of file path.

Game systems reference only the stable Media asset ID. Moving an asset between hosted content and a repository copy therefore does not require rewriting narrative, inventory, cue, or effect references.

## 3. Configure Author access and deploy the Worker once locally

Configure the Worker secret:

```text
ADMIN_KEY
```

Then deploy using the local installation config:

```sh
npx wrangler deploy
```

This first deployment gives the Worker its D1 and R2 bindings. On first use, the Worker initializes its own schema through the canonical project schema/migration owner. No manual D1 table editing is required.

The first local deploy is also useful for later GitHub Actions deployment: the workflow can recover the D1 database ID from the already-deployed Worker's version metadata instead of storing that UUID in Git.

## 4. Point the client at the Worker

Once the Worker URL is known, set:

```text
VITE_API_ORIGIN
```

For the included GitHub Pages deployment workflow, use the repository variable:

```text
PRE_PROGRAMMED_API_ORIGIN
```

The Pages base path is derived from the repository name automatically. `VITE_BASE_PATH` remains available for nonstandard deployments.

## 5. Optional GitHub production deployment

The included production workflow expects:

```text
Secrets:
ADMIN_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID

Variable:
PRE_PROGRAMMED_API_ORIGIN
```

The deployment workflow does **not** require a committed `wrangler.jsonc`. It creates a temporary `.wrangler.deploy.jsonc` from `wrangler.template.jsonc` for each production deployment.

By default it derives the Worker name from the GitHub repository name, the D1 name as `<worker-name>-db`, and the Media bucket as `<worker-name>-assets`. If your installation uses different names, set these repository variables:

```text
PRE_PROGRAMMED_WORKER_NAME
PRE_PROGRAMMED_D1_DATABASE_NAME
PRE_PROGRAMMED_ASSET_BUCKET_NAME
```

For the D1 UUID, the workflow supports two paths:

1. If the Worker has already been deployed with its D1 binding, the workflow reads that Worker's version metadata and recovers the `DB` binding ID automatically.
2. For an installation that must deploy through Actions before a Worker version exists, set:

```text
PRE_PROGRAMMED_D1_DATABASE_ID
```

The UUID is then installation configuration supplied by GitHub rather than reusable repository source.

Before Worker deployment, the workflow verifies that the configured R2 Media bucket exists. If it is genuinely absent, it creates the bucket. It does not suppress authentication or API errors. Consequently, the Cloudflare API token must have both the Worker permissions needed for deployment/version inspection **and Workers R2 Storage Write permission** when the workflow may need to create the Media bucket.

Production deployment on `main` is intentionally the only automatic workflow. Prototype branch work does not continuously run CI.

## 6. Verify the installed engine

A successful installation should satisfy these product checks:

1. `/api/health` reports a healthy D1-backed Worker, `mediaPersistence: "r2"`, and Author access configured.
2. `/api/project/snapshot` returns an initialized project.
3. The client loads that project.
4. Author login succeeds.
5. An Author edit can be saved and survives reload.
6. An uploaded/created Media asset can be fetched and survives Worker restart/redeploy.

`npm run verify:local` exercises persistent D1 project state and R2 Media content together across a local runtime restart. The production deployment workflow separately verifies the hosted Worker health and a real project-snapshot read after deployment.

## Media migration note

The Media foundation no longer stores base64/data-URL bytes inside D1. Migration 20 preserves legacy Media asset identity and metadata but intentionally removes the old `data_url` payload. Any previously embedded uploaded assets therefore need a **one-time re-upload** after this migration.

This is a deliberate foundation replacement rather than a permanent compatibility layer: future references remain stable because content location is no longer encoded into those references.

## What belongs to the installation

These are installation state, not engine behavior:

- Worker name;
- Cloudflare account credentials;
- D1 database name and ID;
- R2 Media bucket name and contents;
- Author key;
- hosted API origin;
- GitHub Pages repository/base path.

The local `wrangler.jsonc`, `.env.local`, and generated deployment Wrangler config are therefore not canonical engine source.

## What remains to prove for a new installation

A literal clean-install acceptance run is still the final proof for any new clone/fork:

1. create a fresh fork or clone;
2. run setup;
3. create its D1 database and R2 Media bucket;
4. deploy its Worker;
5. load the client;
6. enter Author mode;
7. save an edit and a Media asset;
8. reload and confirm both persisted.

After setup, nodes, interactions, characters, locations, variables, items, conditions, effects, commands, Media assets, and other ordinary game systems should be authored through the engine rather than by editing application source.
