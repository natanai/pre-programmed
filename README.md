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

### One owner, many Author entry points

Every authorable resource should have one canonical feature-owned editor and save path. Whenever Author mode shows or references that resource, the author should be able to enter that same editor directly from the current context through the recursive task system. Referencing surfaces should nest the owner's editor rather than duplicate it or force the author to back out and rediscover the resource through another tool.

See [`docs/author-resource-ownership.md`](docs/author-resource-ownership.md) for the full ownership and reachability rule.

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

Author mode can work with narrative nodes and responses, characters and locations, State variables and player groups, inventory and body equipment, operations, commands, Media, project settings, and other feature-owned resources installed in the build.

The shared Author UI rules are documented in [`docs/author-ui-grammar.md`](docs/author-ui-grammar.md).

## Core runtime concepts

### Nodes, input, and outcomes

A node is a playable narrative state. Authored user input can select ordered outcomes. Outcomes can return text, use a speaker, apply effects, stay at the current node, or transition elsewhere. Conditions determine which outcome applies.

### State and operations

State owns variables, computed values, and their optional player presentation. A State value may remain completely internal or appear in an author-named player group such as Attributes, Relationships, Reputation, or any game-specific category. Both groups and individual entries can use the ordinary condition system, so player-visible information can appear or disappear as the game changes.

Inventory does not own or render generic State/status data; it owns carried items, the inventory grid, body types, slots, and equipment behavior.

Feature-owned operations apply behavior to targets without moving target behavior into a central command system.

### Inventory and Body Types

A Body Type owns an explicit logical canvas plus semantic equipment slots. The default canvas is 48×64 with `contain` background fitting, but authors may use any positive canvas width and height and may choose `contain` or `cover`. Canvas numbers are layout units, not image-pixel requirements.

Body slots are stored in that Body Type's logical coordinates. Stable slot keys—not screen positions—carry equipment meaning between Body Types, so a `head` or `left_hand` slot may move visually or use a different canvas while preserving authored equipment behavior. Player Inventory and Body authoring render the same slot geometry through the shared Inventory Body renderer.

Body background art is an ordinary `media-image` reference. Repository image files become selectable Media after they are shipped under `public/assets/`, while scalable vector images can be created inside Author mode and stored through the D1 generated-Media path. Inventory only asks the Author resource system for an image reference; it does not own Media storage or creation rules.

### Commands

Project command grammar can map reusable wording to feature-owned targets and operations. Local scene aliases remain available for specific narrative interactions.

### Player progress

Player progress is stored locally in the browser. Saved state uses project identities rather than storage locations so project assets and authored references can move without rewriting player data.

## Media

Game systems reference **stable Media IDs**. They do not store repository paths, API URLs, data URLs, or browser object URLs as project identity.

The bundled engine intentionally has two Media content origins:

- **D1-authored Media**: synth definitions and textual/vector content created inside Author mode, including scalable vector-grid SVG;
- **repository Media**: audio, conventional images, and other ordinary files shipped under `public/assets/`.

The rest of the engine consumes the same stable Media reference regardless of origin. A `play sound` effect, for example, can resolve either a D1 synth or a repository audio file without inventory, narrative, or another feature knowing how the sound is stored.

Binary file uploading is deliberately not an Author-mode storage feature. Larger or conventional files belong in the repository so they are version-controlled, portable with the game, and require no separate blob-storage service.

### Vector asset authoring

The Media tool includes a logical-grid vector drawing surface with reusable canvas presets and custom rectangular dimensions. The default presets are 32×32 Square / Sprite and 48×64 Portrait. These numbers are authoring units, not rendered pixel requirements. Generated SVG uses the chosen logical dimensions as its viewBox and scales cleanly in the player. The SVG source is stored through the D1-backed generated-Media content path.

### Synth authoring

Synth sounds are stored as reusable synth definitions in project data. They are reconstructed by the browser's synth player; they are not rendered into uploaded audio blobs.

### Repository Media

Repository-managed files live under:

```text
public/assets/
```

A repository file is identified by a neighboring `.asset.json` sidecar containing its stable Media ID. Authored rules reference that ID rather than the path, so files can be reorganized without rewriting gameplay data.

Example:

```text
public/assets/audio/door-creak.ogg
public/assets/audio/door-creak.ogg.asset.json
```

```json
{
  "id": "your-stable-media-id",
  "name": "Door creak"
}
```

The build generates the repository Media manifest. Broken project metadata remains visible in Author mode as missing content so an author can restore a repository file using the same stable ID instead of being shown a false playable asset.

## Storage model

| Data | Default responsibility |
| --- | --- |
| Engine source and repository Media files | Git repository |
| Mutable project structure and Media metadata | Project persistence adapter; Cloudflare D1 in the bundled hosted adapter |
| Synth definitions | Project D1 data |
| Author-created textual/vector Media | D1 generated-Media content |
| Player-local progress, cache, queued edits | Browser storage |

Cloudflare is a bundled platform implementation, not the definition of the engine. Feature code should depend on engine/platform contracts rather than Cloudflare APIs.

## Repository layout

```text
public/assets/             version-controlled file Media
src/App.tsx                application/session composition shell
src/engine/                shared contracts and composition roots
src/features/              feature-owned vertical slices
src/author/                shared Author task/UI system
src/platform/              client/platform adapters
worker/features/           feature-owned Worker persistence/validation contributions
worker/db/                 schema composition and migrations
worker/mediaContent.ts     D1 generated-Media content boundary
scripts/                   setup, local-runtime, build, and deployment helpers
tests/                     small cross-cutting safety/contract suite
.github/workflows/         production deployment only
```

## Verification policy

Rapid prototyping should not require a growing compatibility test suite.

The retained centralized tests focus on cross-cutting contracts that can strand or corrupt authored work, such as authentication, persistence, backup, migrations, player-save compatibility, API synchronization, and generated Media content safety. Feature-specific tests may be deleted, rewritten, or moved with the feature they protect.

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

Local-only use does not require a Cloudflare account. Hosted deployment currently ships with Cloudflare Worker/D1 adapters. File Media remains ordinary repository content rather than requiring a separate object-storage service.

## Production workflow

`main` is the production deployment branch for this repository. The tracked GitHub Actions workflow prepares installation-specific Worker configuration, deploys that installation's Worker, captures the deployment URL reported by Wrangler, builds the client against that URL, verifies the API and Media persistence contract, and publishes GitHub Pages.

A cloned installation must provide its own credentials and persistence configuration. It does **not** need to copy this repository owner's Worker URL: the default workflow discovers its own deployment target, while `PRE_PROGRAMMED_API_ORIGIN` remains an optional override for custom API domains. The reusable client contains no upstream production fallback.

See [`docs/installation.md`](docs/installation.md) for the required configuration and [`docs/local-runtime.md`](docs/local-runtime.md) for the no-cloud local path.
