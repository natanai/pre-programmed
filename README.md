# Pre-Programmed

Pre-Programmed is a browser-based text adventure engine built around one idea: **play the game and author it at the same time**.

Authors create ordinary game content from the running game through Author mode instead of editing source files or database rows by hand. The engine is still in rapid prototyping, so replaceable systems are preferred over compatibility layers that preserve obsolete prototypes.

## Quick start

Requirements:

- Node.js 22+
- npm

Run the complete engine locally:

```sh
npm install
npm run local
```

Open `http://127.0.0.1:5173`, type:

```text
admin
```

and use the local Author key:

```text
local
```

Local mode uses the same Worker, schema, Author UI, mutation system, and game runtime as hosted mode. Its D1 data stays local under `.wrangler/local-runtime`.

## Engine principles

### One engine, one Author system

Desktop and mobile expose the same capabilities, task state, save paths, feature logic, and authored-data meaning. Responsive behavior may change layout and presentation, but it must not fork the product into desktop and mobile implementations.

### Feature-owned vertical slices

A feature should own its model, runtime behavior, Author contribution, validation, persistence contribution, and player presentation where applicable. Shared engine code composes those contributions; it should not grow feature-specific implementation branches.

See [`docs/feature-boundaries.md`](docs/feature-boundaries.md) before substantial engine changes.

### Replace prototypes instead of preserving them

This repository is intentionally allowed to evolve quickly. When a prototype foundation is no longer suitable, replace it and delete the superseded implementation. Tests, documentation, adapters, and UI rules should evolve with the systems they protect rather than forcing removed behavior to survive.

## Author mode

On a running game, type:

```text
admin
```

Then enter the configured Author key.

The normal authoring loop is:

1. Play to the part of the game you want to work on.
2. Open or create the relevant resource in Author mode.
3. Save the task.
4. Preview or return to play.
5. Exercise the authored behavior through the real runtime.

Author mode can work with narrative nodes and responses, characters and locations, variables, inventory, operations, commands, Media, project settings, and other feature-owned resources installed in the build.

The shared Author UI rules are documented in [`docs/author-ui-grammar.md`](docs/author-ui-grammar.md).

## Core runtime concepts

### Nodes, input, and outcomes

A node is a playable narrative state. Authored user input can select ordered outcomes. Outcomes can return text, use a speaker, apply effects, stay at the current node, or transition elsewhere. Conditions determine which outcome applies.

### State and operations

Variables and computed values provide reusable project state. Feature-owned operations apply behavior to targets without moving target behavior into a central command system.

### Commands

Project command grammar can map reusable wording to feature-owned targets and operations. Local scene aliases remain available for specific narrative interactions.

### Player progress

Player progress is stored locally in the browser. Saved state uses project identities rather than storage-provider URLs so project assets and authored references can move between providers without rewriting player data.

## Media

Game systems reference **stable Media asset IDs**. They do not store repository paths, D1 URLs, R2 URLs, data URLs, or browser object URLs as project identity.

A Media asset stores identity and presentation metadata. Content resolution is handled by platform adapters.

The default engine can resolve content from:

- **D1 text content** for textual/vector Media such as Author-created SVG;
- **repository Media** under `public/assets/`;
- **optional blob storage** for hosted binary uploads.

The included Cloudflare adapter can use R2 for optional binary storage, but R2 is not part of the Media domain contract and is not required for text authoring, SVG authoring, repository Media, or the core engine.

### 32×32 vector authoring

The Media tool includes a 32×32 vector drawing surface. The grid is an authoring coordinate system, not a fixed display size. Generated SVG uses a `0 0 32 32` viewBox and can scale cleanly in the player.

### Repository Media

Repository-managed files live under:

```text
public/assets/
```

A repository asset may have a neighboring `.asset.json` identity sidecar. Stable identity lets an asset move between hosted content and repository content without rewriting every game reference.

## Storage model

| Data | Default responsibility |
| --- | --- |
| Engine source and repository Media | Git repository |
| Mutable project structure and Media metadata | Project persistence adapter; Cloudflare D1 in the bundled hosted adapter |
| Author-created textual/vector Media | Media content adapter; D1 text storage in the bundled hosted adapter |
| Optional hosted binary Media | Optional blob provider such as R2 |
| Player-local progress, cache, queued edits | Browser storage |

Cloudflare is a bundled platform implementation, not the definition of the engine. Feature code should depend on engine/platform contracts rather than Cloudflare APIs.

## Repository layout

```text
public/assets/             repository-managed Media
src/App.tsx                application/session composition shell
src/engine/                shared contracts and composition roots
src/features/              feature-owned vertical slices
src/author/                shared Author task/UI system
src/platform/              client/platform adapters
worker/features/           feature-owned Worker persistence/validation contributions
worker/db/                 schema composition and migrations
worker/mediaContent.ts     hosted Media content boundary
scripts/                   setup, local-runtime, build, and deployment helpers
tests/                     small cross-cutting safety/contract suite
.github/workflows/         production deployment only
```

## Verification policy

Rapid prototyping should not require a growing compatibility test suite.

The retained centralized tests focus on cross-cutting contracts that can strand or corrupt authored work, such as authentication, persistence, backup, migrations, player-save compatibility, API synchronization, and hosted Media content safety. Feature-specific tests may be deleted, rewritten, or moved with the feature they protect.

Useful checks:

```sh
npm run typecheck
npm test
npm run build
npm run verify
npm run verify:local
```

`npm run verify` is the explicit full checkpoint. Ordinary branch work does not automatically run a full verification workflow.

## New installation

For a new fork or clone intended to become its own game installation, follow [`docs/installation.md`](docs/installation.md).

The supported goal is:

> clone or fork → connect the installation's own persistence/runtime → enter Author mode → build a complete game without ordinary source-code edits

Local-only use does not require a Cloudflare account. Hosted deployment currently ships with Cloudflare Worker/D1 adapters and optional R2 support, but those services remain behind replaceable platform boundaries.

## Production workflow

`main` is the production deployment branch for this repository. The tracked GitHub Actions workflow builds the client, prepares installation-specific Worker configuration, deploys the Worker, verifies the configured API, and publishes GitHub Pages.

A cloned installation must provide its own deployment variables and secrets. The workflow must never fall back to this repository owner's production API.

See [`docs/installation.md`](docs/installation.md) for the required configuration and [`docs/local-runtime.md`](docs/local-runtime.md) for the no-cloud local path.
