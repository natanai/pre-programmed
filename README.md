# Pre-Programmed

A browser-based text RPG and live authoring engine. This README is an owner’s map of how the project works, not a contributor rulebook.

## The short version

The public game is here:

- App: https://natanai.github.io/pre-programmed/
- API: https://pre-programmed.natanai.workers.dev/api/*

The project is split into three practical pieces:

| Thing | Where it lives |
| --- | --- |
| App code, visual UI, game-engine code, fonts, images, audio | GitHub repo |
| Mutable authored game data | Cloudflare D1 |
| Temporary local cache / queued edits | The browser |

Normal authoring happens **inside the live game**, not by hand-editing D1 or source files.

## Author mode

On the live game, type:

```text
admin
```

Then enter the author key.

Once authenticated, the same game you are playing gains author controls. The basic editing loop is:

1. Stand at the part of the game you want to edit.
2. Add or edit a **User Input** from that point.
3. Define what happens when the player types it.
4. Save.
5. Immediately type it into the terminal and test it.

The square control in the upper-right toggles between the Author view and a cleaner player preview. The gear opens local display settings such as text size and reduced motion.

## The main concepts

### Node

A node is a playable narrative state: the text the player is currently at.

`EDIT NODE-TEXT` changes the current node’s text.

A node can have many User Inputs leading away from it, staying on it, or doing other things without moving anywhere.

### User Input

A User Input is something the player can type at the current node.

Examples:

```text
cry
look around
wiggle toes
open the door
```

The primary input text is what the parser accepts. Optional alternate phrasings can point to the same behavior instead of duplicating it.

Internally the engine still calls those alternate phrasings **aliases**. In practical terms, an alias just means “also accept this wording.”

### Outcome / response

A User Input can have one or more outcomes.

The simplest outcome is:

```text
USER INPUT
cry

→ RESPONSE
You cried.

→ AFTERWARD
stay here
```

An outcome can instead move to another node, and it can have conditions such as first attempt, second attempt, a variable value, possession of an item, or whether another node has been visited.

### Effects

An outcome can also run effects. Current effect types include:

- set or clear a flag
- set, increment, or decrement a value
- give or remove an item
- change item state
- show or hide another interaction
- show a floating notification
- play a synth sound
- play a repository audio file
- show sprite/art
- transition to another node

Effects run in the order shown in the editor.

## A few Author labels that are easy to confuse

- **USER INPUTS FROM HERE** — things the player can type at the current node.
- **[D]** on a User Input — the interaction still has draft/unconfigured behavior.
- **[H]** — the configured result stays at the current node.
- **MATCH** — parser diagnostic showing what matched the player’s last command. This is author/debug information, not player-facing text.
- **INVALID INPUT** — the optional fallback behavior for commands that do not match any normal User Input at this node.

The Structure tool contains additional relationship notation for navigating the game graph. You do not need that notation just to write ordinary responses.

## Assets

Put any file you want the app to detect and assign under:

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

The build scans everything below `public/assets/` recursively.

Supported formats:

```text
Images: PNG, WebP, GIF, SVG
Audio:  MP3, WAV, OGG
```

For example:

```text
public/assets/sprites/openeye.svg
```

is served by the built app as:

```text
/assets/sprites/openeye.svg
```

You do **not** need to hand-write that path in ordinary Author editing. Detected files appear in the asset selector after the asset has been committed to `main` and the deployment finishes.

The generated asset manifest is build output. Do not maintain it by hand; the build recreates it from `public/assets/`.

## Small sprites vs larger artwork

Image size now decides how a `show sprite/art` effect is presented automatically:

- **32×32 pixels or smaller in both dimensions** → appears inline in the terminal transcript and remains in the scrollback history.
- **Anything larger than 32 pixels in either dimension** → uses the large artwork pop-out with a Close control.
- If an image’s dimensions cannot be determined, it falls back to the large pop-out rather than accidentally treating large art as a sprite.

This means a small file such as `sprites/openeye.svg` behaves like a graphical interruption inside the text log, while larger scene or illustration art gets the more dramatic full presentation.

PNG, GIF, WebP, and normal SVG dimension information is detected during the build. SVGs can use explicit width/height or a viewBox.

## Audio

There are two different sound systems.

### Repository audio

Recorded audio belongs under `public/assets/audio/` and can be selected from a `play repo audio` effect after deployment.

Use this for music, ambience, recorded effects, or anything that already exists as an audio file.

### Synth sounds

The Sound author tool creates small browser-rendered synth/chip sounds. Those are structured game data rather than uploaded audio files.

Use this when you want the game itself to generate the sound.

## Inventory and status

Typing either of these opens the player inventory:

```text
inventory
inv
```

### Items

Item definitions can have:

- a name and description
- an optional detected image asset
- grid width / height
- stacking rules
- a default starting quantity
- supported operations such as inspect, use, move, or remove
- custom responses/effects when an operation is attempted

A nonzero **default quantity** means new playthroughs begin with that item already present.

### Variables and computed values

`STATE + PEOPLE` contains state definitions.

Variables are values stored in the play state. They may be numbers, booleans/flags, or text values. Numeric variables can also change automatically over time.

Computed values are read from safe runtime facts such as elapsed session seconds or commands entered.

Variables and computed values can be exposed in the inventory/status area, and exposed status values can be made interactable with operation hooks.

### Characters and locations

Characters and locations are reusable named entities stored with the project. They are currently managed alongside state definitions under `STATE + PEOPLE`.

## Structure

`STRUCTURE` is the author-side navigator for seeing how the current point relates to the rest of the game.

It is meant for navigating and inspecting connections, not as a giant Twine-style canvas that you must manage before writing.

For ordinary writing, stay focused on the current node and its User Inputs; open Structure when you actually need to understand or jump through connections.

## Locations, history, and backup

### Locations

Author locations/bookmarks capture a useful testing position so you can return to a particular game state later.

### History

Durable author changes create revisions. The History tool is where revision/restore functionality lives.

### Backup

In Author mode, use the Backup control or type:

```text
backup
```

or:

```text
/backup
```

This downloads a JSON backup generated from the D1 data.

## Saving and browser behavior

Author edits update the local UI immediately, are cached in the browser, and are sent to D1.

If the network is temporarily unavailable, the app can retain a queued local mutation and synchronize it later. If a newer server revision conflicts with the edit, the app refreshes to the newer project rather than silently overwriting it.

The browser cache is there for responsiveness and temporary resilience. **D1 is still the durable mutable game data.**

## Display settings

The gear in the upper-right currently contains:

- text size, 12–24px
- reduce motion

These settings live in the local browser, not in D1, because they are display preferences rather than game content.

## Working directly in the repo

The parts you are most likely to care about are:

```text
public/assets/             files you make for the game
src/App.tsx                main live terminal / play-author shell
src/components/            Author tools and UI surfaces
src/game/                  parser, runtime, state, inventory, effects, graph logic
src/data/                  API and browser persistence helpers
worker/                    Cloudflare API Worker
migrations/                D1 schema migrations
scripts/                   small build helpers such as asset detection
.github/workflows/deploy.yml
                           the one production deployment workflow
```

There is intentionally no large process/rules documentation layer around the prototype. The code and this practical README should be enough to orient yourself.

## Running locally

```sh
npm install
npm run dev
```

The asset manifest is generated automatically before development/build commands that need it.

Useful commands if you specifically want them:

```sh
npm run build
npm run build:pages
npm run typecheck
npm test
```

Tests remain available as a development tool; they are not meant to turn every experimental edit into a heavy process.

## Production deployment

Production has one deployment owner: GitHub Actions.

Pushing or merging to `main` runs:

```text
main
  ↓
build GitHub Pages client
  ↓
deploy Cloudflare API Worker
  ↓
verify live API
  ↓
publish GitHub Pages
```

The Cloudflare Git-build integration should remain disconnected; Cloudflare is the runtime/API host, not a second source-controlled deployment pipeline.

The live URLs are:

- https://natanai.github.io/pre-programmed/
- https://pre-programmed.natanai.workers.dev/api/*

If a just-deployed UI appears stale, first hard-refresh the Pages site so the browser is not showing an older client bundle.
