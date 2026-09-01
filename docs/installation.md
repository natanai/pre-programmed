# Installing Pre-Programmed as a New Game Engine Instance

This is the transitional installation path while the guided bootstrap command is still being built.

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

### 2. Start from the portable Wrangler template

`wrangler.template.jsonc` contains the reusable Worker shape with a draft `DB` binding and no account-specific D1 ID.

For a separate installation, use that template as the starting Wrangler configuration and choose a Worker name for the new game.

Current Wrangler versions can provision a D1 resource for a draft D1 binding during development/deployment. This is why the reusable template intentionally contains only:

```json
{
  "binding": "DB"
}
```

rather than another installation's database ID.

### 3. Configure the Author secret

The Worker expects `ADMIN_KEY`.

For GitHub deployment, the existing workflow also expects these repository secrets:

- `ADMIN_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Secrets belong in GitHub/Cloudflare configuration, not committed files.

### 4. Point the client at the installation's Worker

The client now supports:

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

### 5. GitHub Pages base path

The deployment workflow now derives the Pages base path from the repository name automatically.

For nonstandard builds, the client also supports:

```text
VITE_BASE_PATH
```

`.env.example` documents both current client-side override points.

## What still needs automation

This is not yet the final desired installation experience.

A future setup/bootstrap command should:

1. authenticate/confirm Cloudflare configuration;
2. choose the Worker/game name;
3. provision or attach D1;
4. configure the installation without hand-editing reusable engine files;
5. initialize/verify schema;
6. establish the hosted API origin;
7. guide GitHub secret/variable setup when GitHub Pages deployment is desired;
8. verify that Author mode can log in and save.

Until that exists, this document is a supported transitional path, not the definition of "finished" portability.

## After installation

Ordinary game creation should happen through Author mode rather than source edits: nodes, responses, characters, locations, variables, items, conditions, effects, commands, and other authored systems should remain project data unless a creator is intentionally developing the engine itself.
