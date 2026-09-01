# Install Pre-Programmed as a New Game Engine Instance

The goal is simple: **fork/clone → connect your infrastructure → create the game in Author mode.** Ordinary game content should not require changes to engine source.

The repository does not carry any installation's D1 database UUID. `wrangler.jsonc` is local installation state and is intentionally ignored by Git.

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
- a local, ignored `wrangler.jsonc` based on `wrangler.template.jsonc`;
- `.env.local` with client API/base-path settings;
- a Pages base path inferred from the GitHub repository name when possible.

It does **not** create Cloudflare resources by itself.

For normal forks, the default Worker name is the repository name and the default D1 name is `<worker-name>-db`. A direct upstream clone uses a safer `my-...` Worker-name default so it cannot casually collide with the original installation.

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
PRE_PROGRAMMED_API_ORIGIN
PRE_PROGRAMMED_REPOSITORY_NAME
PRE_PROGRAMMED_BASE_PATH
```

## 2. Create this installation's D1 database

Authenticate Wrangler with the Cloudflare account that should own the game.

The setup helper prints the exact command for the database name you chose. It has this form:

```sh
npx wrangler d1 create YOUR_DATABASE_NAME --binding DB --update-config
```

`--binding DB` assigns the binding expected by the Worker, and `--update-config` writes the newly created database name and UUID into the local `wrangler.jsonc`.

After it succeeds, the local configuration should contain:

```json
{
  "binding": "DB",
  "database_name": "YOUR_DATABASE_NAME",
  "database_id": "YOUR_DATABASE_UUID"
}
```

Do not copy another installation's database ID. That UUID belongs only to the D1 database created for this game, and the file containing it is not committed to reusable source.

## 3. Configure Author access and deploy the Worker once locally

Configure the Worker secret:

```text
ADMIN_KEY
```

Then deploy using the local installation config:

```sh
npx wrangler deploy
```

This first deployment gives the Worker its D1 binding. On first use, the Worker initializes its own schema through the canonical project schema/migration owner. No manual D1 table editing is required.

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

By default it derives the Worker name from the GitHub repository name and the D1 name as `<worker-name>-db`. If your installation uses different names, set these repository variables:

```text
PRE_PROGRAMMED_WORKER_NAME
PRE_PROGRAMMED_D1_DATABASE_NAME
```

For the D1 UUID, the workflow supports two paths:

1. If the Worker has already been deployed with its D1 binding, the workflow reads that Worker's version metadata and recovers the `DB` binding ID automatically.
2. For an installation that must deploy through Actions before a Worker version exists, set:

```text
PRE_PROGRAMMED_D1_DATABASE_ID
```

The UUID is then installation configuration supplied by GitHub rather than reusable repository source.

The Cloudflare API token must have the Worker permissions needed for deployment and for reading the deployed Worker version metadata. The normal Worker Scripts write/read permissions satisfy that path.

Production deployment on `main` is intentionally the only automatic workflow. Prototype branch work does not continuously run CI.

## 6. Verify the installed engine

A successful installation should satisfy these product checks:

1. `/api/health` reports a healthy D1-backed Worker with Author access configured.
2. `/api/project/snapshot` returns an initialized project.
3. The client loads that project.
4. Author login succeeds.
5. An Author edit can be saved and survives reload.

The production deployment workflow performs the infrastructure-side health checks, including a real project-snapshot read after Worker deployment. The final Author login/save remains a real-client acceptance test because it verifies the complete installation rather than only infrastructure.

## What belongs to the installation

These are installation state, not engine behavior:

- Worker name;
- Cloudflare account credentials;
- D1 database name and ID;
- Author key;
- hosted API origin;
- GitHub Pages repository/base path.

The local `wrangler.jsonc`, `.env.local`, and generated deployment Wrangler config are therefore not canonical engine source.

## What remains to prove

The repository path is now installation-neutral, but one literal clean-install acceptance run is still required before clone/fork portability should be called fully proven:

1. create a fresh fork or clone;
2. run setup;
3. create its D1 database;
4. deploy its Worker;
5. load the client;
6. enter Author mode;
7. save an edit;
8. reload and confirm that edit persisted.

After setup, nodes, interactions, characters, locations, variables, items, conditions, effects, commands, and other ordinary game systems should be authored through the engine rather than by editing application source.
