# Run Pre-Programmed entirely on a local machine

This is the first supported local distribution path. It uses the same Worker, D1 schema/migrations, project model, mutation handlers, Author UI, history, undo, and save semantics as the hosted build, but runs them locally through Wrangler/Miniflare.

It does **not** connect to the production D1 database.

## Requirements

- Node.js 22+
- npm

No Cloudflare account or remote D1 database is required for the local runtime itself.

## Start

```bash
npm install
npm run local
```

Then open:

```text
http://127.0.0.1:5173
```

Enter Author mode with:

```text
admin
```

The default local Author key is:

```text
local
```

## Where local saves live

The local Worker runs with `wrangler.local.jsonc` and persists its local-only D1 state under:

```text
.wrangler/local-runtime
```

`.wrangler/` is ignored by Git. Closing and reopening `npm run local` should preserve authored project data on the same machine.

To deliberately reset the local project, stop the runtime and delete `.wrangler/local-runtime`.

## Separation from hosted production

The tracked `wrangler.local.jsonc` contains only a fixed local-development identity. Production deployment does not use it. Hosted deployment continues to generate `.wrangler.deploy.jsonc` from the installation's real Worker/D1 binding.

Do not add `remote: true` to the local D1 binding. Local mode is intended to stay isolated from hosted data.

## Current acceptance status

The architecture reuses the hosted Worker and canonical schema, so local mode does not fork game/save behavior. Before calling local portability complete, run the full acceptance path on a clean machine/check-out:

1. `npm install`;
2. `npm run local`;
3. verify the starter project loads;
4. enter Author mode with the local key;
5. save an edit;
6. stop both processes completely;
7. run `npm run local` again;
8. confirm the edit remains.

Any friction discovered by that run should be fixed in this path rather than by creating a separate local Author implementation.
