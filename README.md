# Pre-Programmed

A browser-based text RPG and live authoring engine. The central idea is that authors can **play and build the game at the same time**: ordinary game content is created through Author mode rather than by hand-editing source code or databases.

The engine is intentionally modular and still in rapid prototyping. Experimental foundations should be replaceable instead of accumulating compatibility layers.

## Live installation

- App: https://natanai.github.io/pre-programmed/
- API: https://pre-programmed.natanai.workers.dev/api/*

## The short version

| Thing | Default location |
| --- | --- |
| Engine code, UI, fonts, repository-managed Media | Git repository |
| Mutable project structure and Media metadata | D1 through the configured project-persistence adapter |
| Author-created SVG/vector text | D1 through the Media content adapter |
| Uploaded binary Media | Optional blob provider such as R2, or repository Media |
| Temporary cache, player autosave, queued edits | Browser storage |

**R2 is optional.** The engine, Author mode, SVG authoring, player runtime, and production deployment do not require an R2 account or bucket.

Normal authoring happens **inside the running game**.

## Author mode

On the live game, type:

```text
admin
```

Then enter the Author key.

The same running game gains Author controls. The ordinary loop is:

1. Stand at the part of the game you want to work on.
2. Open or create the relevant node, User Input, response, item, character, state, Media asset, or other resource.
3. Save that Author task.
4. Continue editing, preview, or use the master Author exit to return to play.
5. Exercise the authored behavior through the real runtime.

Desktop and mobile use the same Author features, task system, save paths, and runtime. Responsive layout changes presentation rather than capability.

## Core game concepts

### Node

A node is a playable narrative state: the text the player is currently at. A node can have many User Inputs that stay at that node, transition elsewhere, or cause effects without moving.

### User Input and response

A User Input is text the player can type at the current node. Each input can have ordered outcomes. An outcome can return response text, select a speaker, apply effects, stay in place, or transition to another node. Conditions decide which outcome applies.

### Effects

Effects are feature-contributed runtime actions. Current examples include state changes, inventory changes, interaction visibility, notifications, synth playback, recorded audio, artwork presentation, and transitions.

Feature code owns the meaning of its effect. Shared rule/runtime code composes those contributions rather than hard-wiring feature combinations.

## Inline text-performance notation

Node text and response text can contain terse slash notation. The notation compiles into the same performance model used by Author tooling and is removed before the player sees the text.

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

## Media

Media is a feature-owned vertical slice. Game systems reference **stable Media asset IDs**; they do not store repository paths, D1 URLs, R2 URLs, data URLs, or browser-local object URLs.

A Media asset contains project identity and behavior such as:

- stable `id`;
- name and kind (`image` or `audio`);
- MIME type;
- immutable `contentKey`, or `null` when the repository copy is active;
- byte length and intrinsic dimensions when applicable;
- default player presentation (`inline` or `overlay`);
- authoring mode (`file` or `grid32`).

The platform content adapter resolves where a `contentKey` lives.

### Storage-neutral content

The current default adapters resolve content through three independent capabilities:

1. **D1 text content** — textual/vector Media such as SVG.
2. **Repository Media** — source-controlled files under `public/assets`.
3. **Optional blob content** — larger/binary uploads, with Cloudflare R2 supplied as one adapter when configured.

The stable project model does not distinguish those locations. Moving content between providers therefore does not require rewriting narrative cues, inventory references, effects, player saves, or other authored data.

### 32×32 vector authoring

The Media tool includes a 32×32 drawing editor with pencil, eraser, fill, color, Undo/Redo, and clear controls.

The 32×32 grid is an **authoring coordinate system**, not a player pixel-size rule. It serializes to SVG with:

```text
viewBox="0 0 32 32"
```

and no fixed rendered width or height. Player presentation can therefore scale it cleanly as vector artwork.

Author-created SVG text is saved in the existing D1-backed database system. It does not require R2.

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

Supported build-detected formats include PNG, WebP, GIF, SVG, MP3, WAV, and OGG.

Every shipped Media file has an identity sidecar beside it, for example:

```text
openeye.svg
openeye.svg.asset.json
```

The sidecar carries stable asset identity/presentation metadata. Moving an exported hosted asset into the repository does not require changing references elsewhere in the game.

### Optional binary uploads

Binary file uploads need a blob/content provider if they are not promoted to repository Media. The bundled Cloudflare adapter supports R2, but R2 is deliberately **not part of the engine contract**.

If no blob provider is configured:

- text/game authoring continues normally;
- SVG/vector authoring continues normally through D1;
- repository images/audio continue normally;
- binary upload attempts report that optional blob storage is unavailable.

A future installation can provide another blob adapter without changing feature modules or the `MediaAsset` model.

### Import / export

The Author Media tool can export an asset together with its `.asset.json` identity sidecar. This provides a supported promotion path from hosted content into repository-managed content while preserving the same asset ID.

### Player presentation

Image presentation is explicit metadata, independent of intrinsic dimensions:

- `inline` places the image in the terminal transcript;
- `overlay` opens the Media-owned large viewer.

Player autosave stores stable Media IDs rather than resolved URLs.

### Audio

Recorded audio uses the same Media identity/content boundary. Synth sounds are structured project data generated by the browser audio runtime and do not require blob storage.

## Inventory, state, people, and commands

Inventory items can carry Media references, quantities, stacking, equipment rules, operations, and authored operation responses/effects.

Variables and computed values support normal state changes, time-based change, conditions, status exposure, and target operations. Characters and locations are reusable world entities.

Player command grammar can map reusable wording to feature-owned target operations without moving operation behavior into the Commands feature.

## Player saves and Author history

Player progress is stored locally in the browser. Current node, state, inventory, transcript/presentation data, and stable Media references can resume through Continue/New Game behavior.

Durable Author changes create project revisions. Media revisions retain prior immutable `contentKey` references, while the content layer preserves versioned content independently of the current asset metadata.

## Backup

In Author mode, use the Backup control or type:

```text
backup
```

or:

```text
/backup
```

The canonical backup always includes the D1 database. Because D1-backed SVG content is ordinary database data, it is included automatically. If an optional blob provider is configured, its hosted Media objects are also included. Repository Media remains source-controlled and does not need to be duplicated into hosted storage just for backup.

## Architecture

The core rule is:

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

Important paths:

```text
public/assets/             repository-managed Media + identity sidecars
src/App.tsx                application/session composition shell
src/features/              feature-owned vertical slices
src/features/media/        Media model, rules, authoring, player presentation
src/engine/                generic contracts and composition roots
src/author/                shared Author task/UI composition
src/platform/              environment/platform adapters
worker/features/           feature-owned D1 persistence and validation
worker/mediaContent.ts     storage-neutral hosted Media content boundary
worker/db/                 schema composition + historical migrations
scripts/                   setup/build/deployment helpers
.github/workflows/         production deploy + opt-in verification
```

Read `docs/feature-boundaries.md` before substantial engine changes. `docs/installation.md` is the supported fork/clone setup path.

## Running locally

```sh
npm install
npm run local
```

The checked-in local runtime deliberately uses local D1 **without an R2 binding**. This is the default portability proof, not a reduced mode.

For persistence acceptance across a local restart:

```sh
npm run verify:local
```

That check persists project data and SVG content through D1, restarts the runtime, and verifies both survive with no object-storage service.

Useful targeted commands:

```sh
npm run build
npm run build:pages
npm run typecheck
npm test
npm run verify
```

Full verification is intentionally an explicit checkpoint during rapid prototyping rather than an automatic tax on every branch update.

## Installation and production deployment

A base installation needs:

- a runtime/Worker identity;
- a project database;
- an Author key;
- an API origin;
- client hosting/base-path configuration.

An R2/blob bucket is optional.

Use:

```sh
npm run setup:installation
```

for the supported setup journey. See `docs/installation.md` for fork/direct-clone safety and platform configuration.

For the included Cloudflare adapter, D1 remains the current hosted project-database implementation. That is an adapter choice, not permission for feature modules to depend directly on Cloudflare APIs. A future developer should be able to replace persistence adapters without changing authored game references or feature logic.

## Media migration from the prototype

Migration 20 removed the old `data_url`/base64 payload from the Media metadata table. Migration 21 adds a separate immutable **text-content table** for SVG and similar supported text Media.

This does not restore the old embedded-data-URL architecture. Asset identity still points to an immutable `contentKey`; the content adapter decides whether that key resolves from D1 text storage, an optional blob store, or a repository copy.
