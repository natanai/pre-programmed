# Install Pre-Programmed as a New Game Engine Instance

The goal is simple: **fork/clone → connect your infrastructure → create the game in Author mode.** Ordinary game content should not require changes to engine source.

## 1. Fork or clone

Install dependencies:

```sh
npm install
```

For a GitHub **fork**, run:

```sh
npm run setup:installation
```

The helper recognizes the upstream production configuration inherited by the fork and replaces it locally with identity-free installation settings.

For a direct **clone of `natanai/pre-programmed`** that should become a separate game installation, run:

```sh
npm run setup:installation -- --new-installation
```

That explicit flag distinguishes a new clone from an existing checkout of the original production installation. It allows replacement of the inherited upstream configuration without using the broader `--force` escape hatch.

The helper prepares:

- a Worker name;
- a new D1 database name;
- an identity-free `wrangler.jsonc` based on `wrangler.template.jsonc`;
- `.env.local` with client API/base-path settings;
- a Pages base path inferred from the GitHub repository name when possible.

It does **not** create Cloudflare resources by itself.

### Existing-installation safety

After a checkout has its **own** D1 configuration, setup refuses to overwrite it by default.

Only when replacing an already configured installation intentionally should you use:

```sh
npm run setup:installation -- --force
```

If the checkout has no readable GitHub `origin` (for example, a downloaded archive), the helper stays conservative and requires `--force` before replacing an existing D1 configuration.

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

Cloudflare documents `wrangler d1 create` as the explicit D1 creation command. `--binding DB` assigns the binding expected by the Worker, and `--update-config` writes the newly created resource into `wrangler.jsonc`.

After it succeeds, this installation's Wrangler configuration should contain a D1 entry with all three stable identifiers:

```json
{
  "binding": "DB",
  "database_name": "YOUR_DATABASE_NAME",
  "database_id": "YOUR_DATABASE_UUID"
}
```

Do not copy another installation's database ID. The UUID written here must belong to the D1 database just created for this game.

This explicit step is preferred over relying on Wrangler's experimental automatic provisioning of incomplete draft bindings.

## 3. Configure Author access and deploy the Worker

Configure the Worker secret:

```text
ADMIN_KEY
```

Then deploy:

```sh
npx wrangler deploy
```

On first use, the Worker initializes its own schema through the canonical project schema/migration owner. No manual D1 table editing is required.

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

The installation's committed/deployment Wrangler configuration must reference **its own** D1 database name and ID before GitHub Actions is used to deploy it.

Production deployment on `main` is intentionally the only automatic workflow. Prototype branch work does not continuously run CI.

## 6. Verify the installed engine

A successful installation should satisfy these product checks:

1. `/api/health` reports a healthy D1-backed Worker with Author access configured.
2. `/api/project/snapshot` returns an initialized project.
3. The client loads that project.
4. Author login succeeds.
5. An Author edit can be saved and survives reload.

The production deployment workflow performs the infrastructure-side health checks. The final Author login/save remains a real-client acceptance test because it verifies the complete installation rather than only infrastructure.

## What belongs to the installation

These are configuration, not engine behavior:

- Worker name;
- Cloudflare account credentials;
- D1 database name and ID;
- Author key;
- hosted API origin;
- GitHub Pages repository/base path.

Do not copy another installation's resource identity into a new game.

## What remains transitional

The upstream repo still keeps its current production `wrangler.jsonc` checked in so the live prototype is not detached from its existing database. Forks and direct clones now have explicit setup paths that replace that inherited identity locally before they create their own D1 resource.

The remaining portability cleanup is to externalize the original production D1 identity from reusable source control entirely. That requires a proven production deployment replacement for the existing database UUID; it should not be done by making the live Worker discover or provision a different database during deployment.

After setup, nodes, interactions, characters, locations, variables, items, conditions, effects, commands, and other ordinary game systems should be authored through the engine rather than by editing application source.
