# Run Pre-Programmed Locally

Local mode runs the same Worker, project schema, mutation system, Author UI, and game runtime used by the hosted engine, but keeps D1 state on the local machine.

It does **not** connect to the production database.

## Requirements

- Node.js 22+
- npm

No Cloudflare account is required.

## Start

```sh
npm install
npm run local
```

Open:

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

## Local persistence

The local Worker uses `wrangler.local.jsonc` and persists local D1 state under:

```text
.wrangler/local-runtime
```

`.wrangler/` is ignored by Git. Stopping and reopening `npm run local` should preserve authored project data on the same machine.

To reset the local project deliberately, stop the runtime and delete `.wrangler/local-runtime`.

## Isolation rule

Do not add `remote: true` to the local D1 binding.

Local mode is the portability path for running the real engine without remote infrastructure. It should not become a second save engine or a reduced Author implementation.

## Persistence verification

To run the automated local restart check:

```sh
npm run verify:local
```

For a manual check:

1. run `npm run local`;
2. enter Author mode;
3. save a visible project edit;
4. stop the runtime completely;
5. start `npm run local` again;
6. confirm the edit remains.

If local behavior diverges from hosted behavior, fix the shared engine/platform boundary rather than creating a local-only feature implementation.
