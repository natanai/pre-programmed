# Install Pre-Programmed as a New Game Engine Instance

The goal is simple: **fork/clone → connect your infrastructure → create the game in Author mode.** Ordinary game content should not require changes to engine source.

## 1. Fork or clone

Install dependencies:

```sh
npm install
```

Then run:

```sh
npm run setup:installation
```

The helper separates installation configuration from engine behavior. It prepares:

- a Worker name;
- a portable `DB` D1 binding from `wrangler.template.jsonc`;
- `.env.local` with the client API/base-path settings;
- a Pages base path inferred from the fork's GitHub repository name when possible.

### Fork safety

A GitHub fork initially contains the upstream repository's live `wrangler.jsonc`. The setup helper recognizes that specific situation from the Git remote and replaces the inherited upstream installation configuration with portable settings.

After a checkout has its **own** D1 configuration, the helper refuses to overwrite it by default.

Only when replacing an existing installation intentionally should you use:

```sh
npm run setup:installation -- --force
```

If the checkout has no readable GitHub `origin` (for example, a downloaded archive), the helper stays conservative and requires `--force` before replacing an existing D1 configuration.

For non-interactive setup, these environment variables are supported:

```text
PRE_PROGRAMMED_WORKER_NAME
PRE_PROGRAMMED_API_ORIGIN
PRE_PROGRAMMED_REPOSITORY_NAME
PRE_PROGRAMMED_BASE_PATH
```

## 2. Connect Cloudflare

Authenticate Wrangler for the Cloudflare account that should own the game.

The portable template starts with a draft D1 binding:

```json
{
  "binding": "DB"
}
```

Current Wrangler can automatically provision draft resources during deployment. If automatic provisioning is unavailable or you prefer an explicit setup, create D1 directly:

```sh
npx wrangler d1 create YOUR_DATABASE_NAME
```

Then use the returned database name/ID in this installation's Wrangler configuration. Stable D1 bindings ultimately identify the database by name and ID.

Configure the Worker secret:

```text
ADMIN_KEY
```

Then deploy the Worker:

```sh
npx wrangler deploy
```

## 3. Point the client at the Worker

Once the Worker URL is known, set:

```text
VITE_API_ORIGIN
```

For the included GitHub Pages deployment workflow, use the repository variable:

```text
PRE_PROGRAMMED_API_ORIGIN
```

The Pages base path is derived from the repository name automatically. `VITE_BASE_PATH` remains available for nonstandard deployments.

## 4. Optional GitHub production deployment

The included production workflow expects:

```text
Secrets:
ADMIN_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID

Variable:
PRE_PROGRAMMED_API_ORIGIN
```

Production deployment on `main` is intentionally the only automatic workflow. Prototype branch work does not continuously run CI.

## 5. Verify the installed engine

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
- D1 resource identity;
- Author key;
- hosted API origin;
- GitHub Pages repository/base path.

Do not copy another installation's resource identity into a new game.

## What remains transitional

The repo still keeps its current production Wrangler configuration checked in so the live prototype is not detached from its existing database. New forks no longer need to preserve that inherited configuration: `npm run setup:installation` resets it safely when the Git remote identifies a fork.

A future cleanup may move the original production identity entirely outside reusable source control. That should only happen together with a proven deployment replacement path, not by risking the live authored database.

After setup, nodes, interactions, characters, locations, variables, items, conditions, effects, commands, and other ordinary game systems should be authored through the engine rather than by editing application source.
