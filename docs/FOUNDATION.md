# Pre-Programmed foundation

## Thesis

Pre-Programmed is a text RPG whose game interface is also its authoring environment. An unauthenticated player experiences a DOS-like game. Authentication reveals contextual tools for changing the world while playing it.

The authoring loop is:

**play → encounter → alter → immediately continue playing**

## Canonical storage boundary

### GitHub repository
Owns application source and physical/static files: fonts, images, sprites, MP3/audio files, and other fixed assets. A build-generated manifest will make those files browsable/searchable locally in Author mode without querying GitHub at runtime.

### Cloudflare D1
Will own mutable structured data: nodes, interactions, conditions/effects, characters, items, locations, variables, tiny synth recipes, author bookmarks, revision history, player/author saves, and release snapshots.

### Browser
Keeps an IndexedDB working cache and in-memory indexes. Search, graph calculations, parser matching, validation, and synth rendering are local operations.

## Narrative primitives

- **Node** — playable narrative state.
- **Interaction** — something the player can do from a node. It owns its player-facing wording separately from its destination.
- **Stay response** — output/effects that leave the player on the same node.
- **Transition** — output/effects followed by movement to another node.
- **Condition** — determines whether authored content is available.
- **Effect** — changes state (flags, variables, inventory, media, destination, etc.).

Reusable structured entities initially include Characters, Items, Locations, Variables, and Synth Sounds.

### Author interaction language and reveal

The Author UI calls the text a player can type or select **`user-input-text`** and the prose produced by that interaction **`response-text`**. These appear together as one causal editing unit. The primary parser alias is generated from `user-input-text`; alternate aliases remain available behind an advanced disclosure.

Each interaction owns a player-choice reveal setting:

- **show now** — visible immediately beside the prompt
- **show on tap** — revealed when the player taps/clicks the prompt region
- **typing only** — never listed; the player must enter it manually

This presentation setting does not change deterministic parser availability.

New response drafts may remain author-marked `[D]` until their behavior is opened and assigned. Author-only draft notation never leaks into public play.

## Author search/linking

In Author mode, connection-capable text fields are simultaneously text entry and local search. Every keystroke updates a compact result strip directly beneath the field, capped at roughly two visible rows. Results include tight structural notation and can immediately become a link destination without replacing the text being typed.

The browser must already have synchronized project data. Cloudflare is never queried for autocomplete keystrokes.

## Structural notation

Initial author-only grammar:

- `[H]` HERE/current node
- `[A3]` 3 transitions ahead from HERE
- `[P2]` 2 transitions earlier in the current author traversal
- `[B2/4]` back 2 to a useful shared origin, then forward 4 along the candidate branch
- `[D]` unintended structural dead end here
- `[D3]` closest reachable unintended dead end is 3 transitions away
- `[E]` intentional ending
- `[L]` loop/cycle relevant to the route
- `[R]` rejoin/existing incoming route
- `[U]` structurally unreachable from project start

The legend must be rendered from the same definitions used by the engine.

## Structural navigation

The principal structural navigator begins at HERE. It behaves conceptually like a cascading old Windows Start menu, not a Twine canvas. Desktop may cascade sideways; mobile uses nested/sliding levels with the same logical data.

## Author bookmarks

Author locations store node, actual traversal, game-state snapshot, optional note, and timestamp so a working/test state can be restored exactly.

## Parser

Free text is primary. Parser behavior is deterministic: aliases, normalization, token/phrase rules, verb/object rules, known entity vocabulary, then fallback. Author mode can inspect why an input matched and can turn an unhandled input into an alias, inline response, new branch, or connection.

## Text performance

Story prose remains clean text. Performance is separate structured data describing type speed, pauses, local speed changes, wave/shake/blink/instant segments, media cues, and related timing.

## Sound

Binary audio files live in Git. A deliberately tiny built-in sound chip is stored as compact textual D1 recipes and synthesized in the browser using Web Audio. Initial target: 3 tonal voices, 1 noise voice, 16 steps, square/triangle/saw/sine, C2–C7, volume/attack/release, tempo and loop.

## Graphics

Native sprites are at most 32×32 pixels and use pixel-preserving scaling. Larger special-event art may exist as general artwork rather than a Sprite. The graphical inventory is a later reveal and is opened by typed `inventory`/`inv`, not by an always-visible public button.

Item definitions may declare a non-negative starting quantity. A new playthrough deterministically packs those default items into the inventory; Author mode may also add an item to the current test run without changing its starting quantity.

Physical items and nonphysical status entries remain semantically distinct. When an author makes one interactable, its inspect/use/move/remove attempts resolve through the same target-aware runtime path. Attempt counters are keyed by target identity and operation. Computed values remain locally calculated and read-only; attempting an operation may produce authored output and effects without mutating the computed source.

Authenticated authors may temporarily hide all author affordances with the small player/author view toggle. This previews the player experience without ending the authenticated session or changing game state.

On phones, the normal Author workspace includes the software keyboard. Core text editors therefore follow one shared frame: close/context remains at the top, the active form is the only scrolling region, and save/cancel remains visible above the keyboard. Dialogue editing preserves a smaller live-play context above that frame rather than dividing the reduced viewport evenly.

## Release boundary

Author plays mutable Draft. Public players play an immutable structured release snapshot. Because released binary assets remain repository files, a path used by a published release becomes immutable: replacement assets get new paths.

## First acceptance path

Before broadening mechanics, the app must feel good on mobile and desktop when the author: logs in; plays into a node; edits it in place; adds a response; sees local per-keystroke existing-node matches with notation; links one; plays it; reaches `[D]`; writes the continuation; sees the diagnostic disappear locally; bookmarks the state; syncs it; and restores it on another device.
