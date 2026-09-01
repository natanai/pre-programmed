# Installing Pre-Programmed as a New Game Engine Instance

This is the transitional installation path while full one-command bootstrap is still being built.

The target remains: clone/fork → connect infrastructure → do ordinary game creation in Author mode without editing engine source.

## What is engine code vs installation configuration

Engine code should be reusable across games.

Installation-specific values include:

- Worker name
- Cloudflare account credentials
- D1 database binding/resource
- Author key
- hosted API origin
- GitHub Pages repository path

Those values should not become feature/runtime logic.

## Current production installation

The repository's current `wrangler.jsonc` remains the live `natanai/pre-programmed` installation configuration for now. It still contains the existing production D1 identity so this architecture branch does not silently replace or detach the live database.

Do not copy those resource IDs into a fork.

## Starting a new installation

### 1. Fork or clone the repository

Install dependencies normally:

```sh
npm install
```

### 2. Run the guarded installation helper

For a fresh fork/clone:

```sh
npm run setup:installation
```

The helper:

- starts from `wrangler.template.jsonc`;
- chooses a Worker name;
- keeps the D1 binding as a portable draft `DB` binding with no copied database ID;
- writes local client installation values to ignored `.env.local`;
- refuses to overwrite an already configured D1 installation by default.

This refusal is intentional protection for existing deployments. In a checkout that already contains a configured D1 binding, the command stops rather than replacing it.

Only in a **new installation** where replacement is intentional may the guard be overridden:

```sh
npm run setup:installation -- --force
```

The setup helper also accepts environment variables for non-interactive use:

```text
PRE_PROGRAMMED_WORKER_NAME
PRE_PROGRAMMED_API_ORIGIN
PRE_PROGRAMMED_REPOSITORY_NAME
PRE_PROGRAMMED_BASE_PATH
```

### 3. Let Wrangler provision/link D1

`wrangler.template.jsonc` contains the reusable Worker shape with a draft `DB` binding and no account-specific D1 ID:

```json
{
  "binding": "DB"
}
```

Current Wrangler versions can automatically provision a D1 resource for this kind of draft binding during deployment, so reusable templates do not need to commit another installation's resource ID.

### 4. Configure the Author secret

The Worker expects `ADMIN_KEY`.

For GitHub deployment, the existing workflow also expects these repository secrets:

- `ADMIN_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Secrets belong in GitHub/Cloudflare configuration, not committed files.

### 5. Point the client at the installation's Worker

The client supports:

```text
VITE_API_ORIGIN
```

For GitHub Actions, set the repository variable:

```text
PRE_PROGRAMMED_API_ORIGIN
```

to the deployed Worker origin, for example:

```text
https://your-worker.your-subdomain.workers.dev
```

The deployment workflow passes that value to the Pages build and uses the same origin for its API health verification.

### 6. GitHub Pages base path

The deployment workflow derives the Pages base path from the repository name automatically.

For nonstandard builds, the client also supports:

```text
VITE_BASE_PATH
```

`.env.example` documents both client-side override points.

## What still needs automation

This is not yet the final desired installation experience.

The current helper prepares instance configuration but does not yet own the complete external-account workflow. The remaining bootstrap target is to:

1. authenticate/confirm Cloudflare configuration;
2. provision or attach D1 and verify the result;
3. establish/discover the hosted Worker origin automatically;
4. initialize/verify schema explicitly;
5. guide or automate GitHub secret/variable setup when GitHub Pages deployment is desired;
6. verify that Author mode can log in and save.

Until those steps are integrated, this document describes a supported transitional path rather than the definition of finished portability.

## After installation

Ordinary game creation should happen through Author mode rather than source edits: nodes, responses, characters, locations, variables, items, conditions, effects, commands, and other authored systems should remain project data unless a creator is intentionally developing the engine itself.
