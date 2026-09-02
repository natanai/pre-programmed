# Pre-Programmed

A browser-based text RPG and live authoring engine. The central idea is that authors can **play and build the game at the same time**: ordinary game content is created through Author mode rather than by hand-editing source code or databases.

The engine is intentionally modular and still in rapid prototyping. Experimental foundations should be replaceable instead of accumulating compatibility layers.

## Live installation

- App: https://natanai.github.io/pre-programmed/
- API: https://pre-programmed.natanai.workers.dev/api/*

## The short version

| Thing | Where it lives |
| --- | --- |
| Engine code, UI, fonts, and repository-managed Media | GitHub repository |
| Mutable project structure and Media metadata | Cloudflare D1 |
| Uploaded/Author-created Media bytes | Cloudflare R2 |
| Temporary cache, player autosave, and queued edits | Browser storage |

Normal authoring happens **inside the live game**.

## Author mode

On the live game, type:

```text
admin
```

Then enter the Author key.

The same running game gains Author controls. The ordinary loop is:

1. Stand at the part of the game you want to work on.
2. Open or create the relevant node, User Input, response, item, character, state, Media asset, or other resource.
3. Save.
4. Return to play or preview.
5. Exercise the authored behavior through the real runtime.

Desktop and mobile use the same Author features and save/runtime code. Responsive layout may change how those controls are presented, but not which capabilities exist.

## Core game concepts

### Node

A node is a playable narrative state: the text the player is currently at. A node can have many User Inputs that stay at that node, transition elsewhere, or cause effects without moving.

### User Input

A User Input is something the player can type at the current node, for example:

```text
cry
look around
open the door
```

Optional alternate phrasings can point to the same interaction rather than duplicating behavior.

### Outcome / response

A User Input can have one or more ordered outcomes. An outcome can return response text, select a speaker, run effects, stay in place, or transition to another node. Conditions decide which outcome applies.

### Effects

Effects are feature-contributed runtime actions. Current examples include state changes, inventory changes, interaction visibility, notifications, synth playback, recorded audio, artwork presentation, and transitions.

Feature code owns the meaning of its effect. Shared rule/runtime code composes those contributions rather than hard-wiring every feature combination.

## Inline text-performance notation

Node text and normal response text can contain terse slash notation. The notation is compiled into the same performance model used by Author tooling and is removed before the player sees the text.

```text
/p          pause 350 ms
/p800       pause 800 ms
/f{...}     fast text
/s{...}     emphasized/shaking text
/h{...}     instant hard hit
/w{...}     wave
/b{...}     blink
/i{...}     instant reveal
//          literal slash
```

Braces define the affected span explicitly. The local player speed multiplier scales typing speed but does not rewrite authored timing.

## Media

Media is a complete feature-owned vertical slice. Game systems reference **stable Media asset IDs**; they do not store repository paths, data URLs, R2 object URLs, or browser-local file locations.

A Media asset contains project-level identity and behavior such as:

- stable `id`;
- name and kind (`image` or `audio`);
- MIME type;
- immutable hosted `contentKey`, or `null` when the repository copy is active;
- byte length and intrinsic dimensions when applicable;
- default player presentation (`inline` or `overlay`);
- authoring mode (`file` or `grid32`).

Content location is resolved behind the Media platform boundary at runtime.

### Uploaded and Author-created Media

File imports and 32×32 authored vectors upload their bytes to the installation's `ASSET_CONTENT` R2 bucket. D1 stores only metadata and the immutable `contentKey`.

Replacing content creates a new content key rather than overwriting the previous object. That allows revision Undo to restore a prior Media version simply by restoring its prior metadata reference.

Files are currently limited to 20 MB each.

### Repository Media

Repository-managed files live under:

```text
public/assets/
```

Recommended organization:

```text
public/assets/
├── sprites/
├── images/
└── audio/
```

Supported build-detected formats:

```text
Images: PNG, WebP, GIF, SVG
Audio:  MP3, WAV, OGG
```

Every shipped Media file also has an identity sidecar beside it:

```text
openeye.svg
openeye.svg.asset.json
```

The sidecar carries the stable asset ID and presentation metadata. The build fails if a repository Media file lacks identity metadata or duplicates another asset ID.

This separation matters: moving an exported hosted asset into `public/assets` does **not** require changing every narrative cue, item, effect, or other reference that uses it.

The generated asset manifest is build output and is recreated automatically.

### Import / export

The Author Media tool can import normal audio/image files and export an asset together with its `.asset.json` identity sidecar. Exporting an asset is therefore a supported promotion path from hosted content into repository-managed content without minting a new identity.

If an asset has both hosted content and a repository copy, its metadata selects which content is active. Other game modules still reference only the same asset ID.

### 32×32 vector authoring

The Media tool also includes a 32×32 drawing editor with pencil, eraser, fill, color, Undo/Redo, and clear controls.

The 32×32 grid is an **authoring coordinate system**, not a player pixel-size rule. It serializes to SVG with:

```text
viewBox="0 0 32 32"
```

and no fixed rendered width or height. The player can therefore scale it as vector artwork rather than stretching a fixed 32-pixel bitmap.

### Player presentation

Image presentation is explicit metadata, independent of intrinsic dimensions:

- `inline` places the image in the terminal transcript and keeps its stable asset ID in player autosave/history.
- `overlay` opens the Media-owned large viewer.

Inline images can be opened into the same viewer. The viewer supports zoom/reset/close on desktop and touch layouts through the same implementation.

Player autosave stores `artAssetId`, never the resolved asset URL. If content moves between R2 and the repository, resumed player sessions resolve the current content through the same stable identity.

### Audio

Recorded audio files use the Media asset system described above. Synth sounds are separate structured game data generated by the browser audio runtime; they remain a Media feature resource but do not need R2 bytes.

## Inventory and status

Typing either of these opens the player inventory:

```text
inventory
inv
```

Item definitions can have a name, description, Media image reference, grid dimensions, stacking/default quantity, operation capabilities, equipment compatibility, state, and authored operation responses/effects.

Variables and computed values can also be exposed in status and can independently support authored operations.

## Characters, locations, structure, and state

Characters and locations are reusable world entities. Variables and computed values are reusable state definitions. Structure provides an author-side view of graph relationships without requiring authors to manage a giant canvas before writing ordinary interactions.

Feature-specific behavior remains with its owning module; shared navigation and operation contracts compose those features.

## Locations, history, player saves, and backup

### Author locations

Author bookmarks capture useful testing positions so an author can return to a particular project/play state.

### History / Undo

Durable Author changes create revisions. Revision payloads store the prior project snapshot. Media revisions therefore retain prior `contentKey` references; immutable R2 objects remain available so Undo can restore prior Media content as well as metadata.

### Player autosave

Player progress is stored locally in the browser. Presentation data uses stable Media IDs rather than storage URLs. Older v1 saves are upgraded to the current format; obsolete URL-only artwork lines are discarded without discarding otherwise compatible play progress.

### Backup

In Author mode, use the Backup control or type:

```text
backup
```

or:

```text
/backup
```

The canonical backup contains both:

- D1 relational project state;
- hosted R2 Media objects.

Repository Media is already part of source control and therefore does not need to be duplicated as R2 content merely for backup.

## Saving and browser behavior

Author edits update the local UI optimistically and are persisted through the project persistence adapter. If the network is unavailable, supported mutations can queue locally for later synchronization. Revision conflicts synchronize to the newer server project instead of silently overwriting it.

D1 is the durable mutable project/metadata store. R2 is the durable hosted Media-content store. Browser storage is for responsiveness, player-local state, and temporary resilience—not as the canonical Media database.

## Display settings

Player display/playback settings are browser-local because they are preferences rather than game content. Current settings include text size, text-speed multiplier, and reduced motion.

## Architecture

The architecture rule is:

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

Important paths:

```text
public/assets/             repository-managed Media + identity sidecars
src/App.tsx                application/session composition shell
src/features/              feature-owned vertical slices and Author implementations
src/features/media/        Media model, rules, authoring, player presentation
src/engine/                generic contracts and composition roots
src/author/                shared Author navigation/workspace composition
src/platform/              environment/platform adapters
worker/features/           feature-owned D1 persistence and validation
worker/mediaContent.ts     R2 Media-content boundary
worker/db/                 schema composition + historical migrations
worker/projectStore.ts     revision/concurrency/bookmark orchestration
scripts/                   setup/build/deployment helpers
.github/workflows/         production deploy + opt-in verification
```

Read `docs/feature-boundaries.md` before substantial engine changes. `docs/modular-engine-roadmap.md` records remaining modularity work, and `docs/installation.md` is the supported fork/clone setup path.

## Running locally

```sh
npm install
npm run local
```

`npm run local` starts the client plus isolated local Worker storage, including local D1 and R2 bindings.

For a real persistence acceptance across a local restart:

```sh
npm run verify:local
```

Useful targeted commands:

```sh
npm run build
npm run build:pages
npm run typecheck
npm test
```

For an explicit full checkpoint:

```sh
npm run verify
```

Full verification is intentionally not an automatic tax on every prototype branch update.

## Installation and production deployment

A new installation owns its own:

- Worker identity;
- D1 database;
- R2 Media bucket;
- Author key;
- API origin;
- Pages/base-path configuration.

Use:

```sh
npm run setup:installation
```

for the supported setup journey. See `docs/installation.md` for fork/direct-clone safety and Cloudflare/GitHub configuration.

Production has one automatic deployment owner: GitHub Actions. A `main` deployment builds the Pages client, ensures the configured Media bucket exists, prepares the Worker bindings, deploys the Worker, verifies D1 + R2 health and a project snapshot, and then publishes Pages.

The Cloudflare Git-build integration should remain disconnected; Cloudflare is the runtime/storage platform, not a second source-controlled deployment pipeline.

## Media migration from the prototype

Migration 20 intentionally removes the old embedded `data_url` bytes from D1 while retaining Media identity and metadata. Previously embedded files therefore require a **one-time re-upload** after migration.

This is deliberate: the old base64-in-D1 implementation is not kept alive as a second Media system. Durable references now point to stable asset identity while the Media feature resolves content location behind that contract.
