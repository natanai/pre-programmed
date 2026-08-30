# Codex handoff — Pre-Programmed engine milestone

## Mission

You are taking over implementation of `natanai/pre-programmed` from an earlier design/architecture conversation. The goal is not to build a one-off demo sequence. The goal is to make **Pre-Programmed itself a general-purpose, mobile-friendly text RPG authoring engine where the author edits the exact game they are currently playing**.

The user will judge this milestone by logging into Author mode on the real deployed site and attempting to construct a small but mechanically varied playable sequence entirely through the authoring UI. Do **not** seed that sequence, imitate it in code, or add special-case mechanics for it. Implement reusable primitives and direct admin tools so the user can compose the sequence themself without writing code or touching D1 manually.

The guiding product test is:

> Can the author encounter a moment in the game, directly alter its text/behavior/state, create or connect whatever should happen next, immediately play it, and keep doing that from phone or desktop without mentally leaving the game?

If the answer is no, the implementation is not done even if the data model is technically flexible.

---

# 1. Read these files before changing code

Read in this order and treat them as requirements, not suggestions:

1. `AGENTS.md`
2. `docs/FOUNDATION.md`
3. `docs/DOS-VISUAL-TARGET.md`
4. `docs/HOSTING.md`
5. this file
6. current PR #2 and its diff

If code and documentation disagree, preserve the intent in the root `AGENTS.md` and this handoff, then make the code/doc relationship coherent rather than adding compatibility hacks.

---

# 2. Current repository / infrastructure state

## Repository

- Repo: `natanai/pre-programmed`
- Default branch: `main`
- Current integration branch: `d1-author-v1`
- Current open PR: **#2 — `D1-backed opening and first Author edit loop`**
- `main` still lacks the D1/Pages authoring work in PR #2. Do not accidentally base new work only on old `main` and lose that branch.

Preferred workflow:

- inspect PR #2 first
- preserve its working architecture
- either continue the milestone on `d1-author-v1` or create a new branch based on `d1-author-v1` if that is cleaner
- do not use `main` as a scratchpad
- do not create high-frequency/scheduled workflows
- keep GitHub Actions sparse; there should remain one CI/Pages workflow unless a concrete technical requirement proves otherwise

## Hosting ownership

This is now intentionally split:

- **GitHub Pages**: public React client
  - `https://natanai.github.io/pre-programmed/`
- **Cloudflare Worker**: API only
  - `https://pre-programmed.natanai.workers.dev/api/*`
- **Cloudflare D1**: canonical mutable structured game data
- **Git repository**: code, fonts, images, sprites, MP3s, other static/binary assets

The user has already completed the two account-level setup steps:

- GitHub Pages source is set to **GitHub Actions**
- Cloudflare Worker has a private encrypted `ADMIN_KEY` secret configured

Do not ask the user to revisit Cloudflare for routine work. The design goal is **set it and forget it**:

- merge to `main`
- GitHub Actions updates Pages automatically
- Cloudflare's existing Git integration deploys the Worker automatically

If you believe a new dashboard action is unavoidable, first prove that it cannot be handled from repo-owned configuration/code.

## D1

Existing database:

- binding: `DB`
- database name: `pre-programmed-db`
- database id: `c13688ea-4f00-49ac-b7d1-88ba623c4c41`

The Worker currently owns versioned schema initialization/migration through `worker/db/migrations.ts`. Preserve the goal that deployments do not require a human to manually apply migrations.

## Current first slice already implemented on `d1-author-v1`

The branch currently contains:

- D1-backed canonical node #1
- canonical opening text seeded as `you are born`
- `U:\>` Universe-drive prompt
- exact/local DOS-style WOFF font use (`src/Web437_DOS-V_re_ANK16.woff`)
- Author login initiated by typing `admin`
- Worker verifies `ADMIN_KEY` and returns an 8-hour HMAC-signed author token
- raw admin secret is not stored in browser session storage; only the signed token is
- author can click/tap the current story line and edit/save its D1 text
- authenticated database backup command `backup` / `/backup`
- backup is generated from canonical D1 and includes SQLite schema definitions plus every non-internal table and row
- GitHub Pages client build configuration
- Worker API CORS for GitHub Pages and local dev

Do not regress any of this.

---

# 3. Core product identity

## Player mode

An ordinary player should initially believe they are interacting with a literal old DOS-style text program.

No ordinary web-app chrome should be visible.

Canonical first visible words are exactly:

```text
you are born
```

No logo, boot screen, title screen, BIOS simulation, help copy, loading copy, or command prompt appears first.

After the line finishes typing character-by-character, the input appears as:

```text
U:\>_
```

`U:` = **Universe**.

The underscore is a real rendered blinking cursor, not text stored in game content.

Later the program may unexpectedly reveal richer systems — sprites, graphical inventory, larger art, synthesized sound, recorded audio — but these should feel like surprising capabilities of this same fictional machine, not like React modals from a normal SaaS application.

## Author mode

There is no separate conventional CMS as the primary workflow.

Authentication reveals author powers on the **same game currently being played**.

The desired loop is:

**play → encounter → alter → immediately continue playing**

The author should normally not need to know where something lives in SQL or source files.

Examples of the intended pattern (generic, not story content):

- tap/click currently displayed prose → edit it
- inspect current player interaction → change aliases, effects, destination, conditions
- reach an unfinished branch → add what happens next right there
- type a prospective player response → existing matching nodes appear instantly under the same field
- select an existing result → connect to it without replacing the response wording
- inspect an inventory entry while testing it → edit its rules and event hooks
- inspect a state change or notification → edit that effect

Author interfaces may expand beyond the DOS player's visual limitations, but should remain compact, contextual, tactile, and consistent with the machine aesthetic.

---

# 4. Historical DOS visual target

Follow `docs/DOS-VISUAL-TARGET.md`.

Reference target:

- IBM VGA-era DOS text presentation
- CP437-style glyphs / box drawing
- VGA 80×25 conceptual reference
- 720×400 reference raster
- 9×16 character-cell proportions
- VGA text palette capability
- low/full-cell underline-style blinking cursor

Do **not** force a literal fixed 720×400 viewport on phones.

Mobile must remain readable and native to its viewport while preserving glyph raster / cell proportions / pixel character.

No normal gameplay page-level horizontal scrolling.

The supplied Web437 DOS WOFF is the preferred current font.

---

# 5. Canonical ownership boundaries

Do not blur these boundaries.

## Git owns physical files

Repository owns:

- React/TypeScript source
- Worker source
- fonts
- PNG/WebP/GIF where later appropriate
- sprite files
- MP3/recorded audio
- other binary/static media

The editor should eventually expose these through a **local repo-style asset explorer generated from a build-time asset manifest**. It must not query GitHub every time an asset picker opens.

The runtime database stores references/paths to those assets, not duplicate binary blobs.

## D1 owns mutable structured game data

D1 should own reusable, editable data such as:

- nodes
- output blocks / story text
- player interactions / parser aliases
- graph destinations
- conditions
- effects
- characters
- items
- locations
- variables/state definitions
- computed-value definitions where needed
- synth sound recipes
- text-performance metadata
- attempt/event counters as play state
- author bookmarks
- author/test saves
- player saves
- revision history
- release snapshots later

## Browser thinks

The browser should own derived/runtime work:

- IndexedDB project cache
- unsynced mutation queue
- in-memory indexes
- full-text/local search index
- incoming/outgoing graph maps
- dead-end analysis
- branch relationship calculations
- parser matching
- validation
- text rendering
- runtime computed values
- synth playback

**Never query Cloudflare on every keystroke.**

---

# 6. Local-first project synchronization

This is a key architectural requirement, not an optimization for later.

Author mode should evolve toward:

1. load usable project data from IndexedDB if available
2. contact the Worker for current revision / changes
3. synchronize project data to local cache
4. build in-memory search/graph/parser indexes
5. perform ordinary author inspection/search/calculation locally
6. when editing, update local model immediately
7. update UI immediately
8. persist mutation locally
9. queue API persistence to D1
10. acknowledge saved revision

A slow network must not make autocomplete or graph annotations lag behind typing.

The server remains canonical after successful sync.

Do not overbuild Google-Docs-style collaboration. The user is one author, but stale-device safety matters. Use revision-aware writes so an old browser does not silently overwrite a newer project version.

---

# 7. Narrative model to implement

Keep a small composable vocabulary. Do not create separate bespoke schemas for every story trick.

## Node

A Node is a playable narrative state.

A node may own/point to:

- one or more output blocks
- speaker/character metadata
- location context
- media/performance events
- available interactions
- node tags / author metadata
- ending designation

Node references use durable opaque IDs. Human author UI may display stable sequential `#123` numbers for recognition.

## Interaction

An Interaction is something the player can do from the current node.

It needs independent fields for:

- author ID
- player-facing wording where applicable
- parser aliases/patterns
- availability conditions
- effects
- response/output
- disposition: stay vs transition
- destination node when transitioning
- optional tags/notes

**Response wording and destination must remain separate.** Several differently worded player choices may connect to the same node.

## Stay response

An interaction may produce output/effects and leave the player at the same node.

This is essential so minor examinations, jokes, failed actions, repeated local actions, etc. do not explode the graph into unnecessary nodes.

## Transition

An interaction may produce output/effects then move the player to a destination node.

Destination can be:

- create a new node
- connect to an existing node

Both must be equally easy in Author mode.

## Ending

Intentional endings are explicitly marked and must not count as accidental dead ends.

---

# 8. Free-text parser

Free text is the default player interaction mode.

Do not use an AI model or network inference to decide game commands.

Parser must be deterministic and author-inspectable.

A sensible progression is:

1. exact authored aliases
2. normalized aliases (case, punctuation, whitespace)
3. phrase/token rules
4. verb/object rules
5. known entity vocabulary
6. fallback

Author mode needs to expose **why** a command matched.

Unhandled commands should be useful authoring opportunities. When an author enters text that falls through to fallback, provide an author-only contextual action that can turn that input into:

- alias for an existing interaction
- new stay response
- new transition
- new branch
- connection to existing node

Do not show this instrumentation to public players.

---

# 9. Per-keystroke author search and linking

This is one of the most important UX requirements.

Whenever the author types into a field capable of creating/connecting story structure, the same field is also an **instant local search**.

Every character typed updates matching existing project content from the browser's local index.

## Presentation

Do not flood the interface.

The search surface should normally occupy only roughly **one or two visible rows immediately underneath the field**, with internal scrolling for more results.

It is closer to a compact autocomplete strip than a search panel.

Example shape only:

```text
[ author is typing here_ ]
#184 matching existing content    [A3]
#061 another match                [B2/4]
```

Selecting a candidate connects the new interaction to that existing node. It does **not** replace the wording the author typed.

## Search scope

At minimum index locally:

- node text
- response text
- interaction text/aliases
- characters
- items
- locations
- tags

Ranking should combine text similarity with structural usefulness/proximity to HERE.

---

# 10. Author-only graph notation and analysis

The user does not find Twine-style spatial node canvases especially useful. Do not build the product around floating boxes and connection lines.

Prefer dense, textual, local structural information.

Canonical notation vocabulary:

- `[H]` — HERE/current node
- `[A3]` — candidate 3 structural transitions ahead from HERE
- `[P2]` — 2 transitions earlier in the actual author traversal
- `[B2/4]` — back 2 in the current traversal to the nearest useful shared origin, then 4 forward on candidate branch
- `[D]` — unintended structural dead end here
- `[D3]` — closest reachable unintended dead end 3 transitions away
- `[E]` — explicit intentional ending
- `[L]` — loop/cycle relevant to the route
- `[R]` — rejoin / already has another incoming route
- `[U]` — structurally unreachable from project start

Notations should be extremely terse in normal use. Provide a legend (`[?]`, `/legend`, or equivalent) generated from the same definitions used by the graph engine so docs cannot drift.

## Dead-end semantics

An accidental dead node is:

- not marked Ending
- has no outgoing transition to another node

Stay responses do not count as structural continuation.

`[Dn]` is the shortest structural transition distance to such a dead node.

For topology diagnostics, authored conditions should generally be ignored so a structurally valid conditional branch does not appear dead just because the author's current play state fails the condition.

## Current traversal vs graph

Preserve both:

- **actual traversal**: route the author took during this test run
- **graph**: all authored connections

`[P]` is traversal-relative.

Branch notation uses the current traversal as the reference path.

---

# 11. Cascading structural navigator

The structural navigator should be inspired conceptually by an old cascading Windows Start menu, not by Twine.

It always begins at **HERE**, not at the game's start node.

Desktop:

- selecting an outgoing branch may expand another narrow level/column sideways

Mobile:

- same hierarchy becomes nested/sliding levels
- easy Back/swipe to previous level

It should expose local context such as:

- how author arrived HERE
- HERE
- immediate outgoing interactions
- dead/ending/rejoin annotations
- ability to open/edit/connect destinations

A whole-world graph may remain absent indefinitely if local search + cascading structure proves sufficient.

---

# 12. State / variable system

Implement a general state system capable of authoring mechanics without code.

Variables need at least these conceptual scopes:

## Playthrough variables

Persist as part of a player's/tester's game state.

Examples of what the system must support generically:

- numeric counters
- booleans/flags
- strings/enums where later useful

Actions/effects can set, clear, increment, decrement, or otherwise safely update them.

## Session/computed values

Some values should be computed in the client rather than persisted on every tick.

The engine needs a generic mechanism for read-only computed values derived from runtime information, e.g. elapsed client-session time.

Do not hard-code a single named computed statistic. Implement a reusable definition/evaluator model with a small safe vocabulary.

Computed values may be displayed in UI and interpolated into authored output without D1 requests on every update.

## Internal event/attempt counters

The engine needs generic counters such as:

- number of times a specific interaction was attempted
- number of times a specific inventory operation was attempted

Authors should not have to manually create a variable just to distinguish first attempt from subsequent attempts.

Expose simple author conditions such as:

- first time
- second time
- exactly N
- N or more

Internally this may use event counters in play state.

---

# 13. Conditions

Conditions must be composable from Author mode without JavaScript.

Initial condition vocabulary should cover at least:

- has item / lacks item
- flag true/false
- numeric comparison on variable
- event/attempt count comparison
- visited/unvisited node
- current/known state field comparison
- logical AND / OR / NOT grouping

Do not allow arbitrary executable code stored in D1 as a shortcut.

Conditions should be structured, validateable data interpreted by the client engine.

---

# 14. Effects

Implement effects as general structured operations.

Initial vocabulary should include at least:

- set/clear flag
- set numeric/string value
- increment/decrement numeric value
- give item
- remove item
- change item state where applicable
- show/hide/reveal interaction
- add/update an event counter when engine-owned
- show floating notification
- trigger synth sound
- trigger repo audio file
- show/change sprite/art
- transition to node

Effects execute in defined order.

Author UI should make effect sequences understandable and reorderable without code.

---

# 15. Dynamic text interpolation

Authored output must be able to insert state/computed values safely.

Do not use `eval` or arbitrary template JavaScript.

Provide a structured/validated interpolation syntax or token model, for example a value reference selected through UI.

The author should be able to insert a variable/computed value into a line without memorizing database IDs.

Consider simple format transforms such as:

- integer/rounded value
- units / converted value where a reusable safe formatter exists

Keep prose content separate from executable logic.

---

# 16. Inventory architecture

The inventory is one of the deliberate moments when the apparently pure DOS game reveals a surprisingly graphical system.

It should feel visually compatible with the fictional machine, but it is allowed to be substantially more graphical than the terminal.

Public access is primarily by typing:

- `inventory`
- `inv`

Do not add an always-visible public Inventory button at the beginning of the game.

## Physical items

Support general item definitions with fields such as:

- name
- description
- repo sprite/asset reference
- grid width/height
- stackable + max stack
- tags
- state
- conditions/effects/event hooks

The eventual grid can take conceptual inspiration from Diablo II / Path of Exile inventory behavior without copying proprietary assets.

## Non-physical/state display

The same overall inventory experience must be able to display non-physical player state such as:

- read-only/computed properties
- numeric counters / player attributes
- other non-grid state chosen by the author

Do not force every displayed player property to pretend it is a physical item occupying grid cells.

Provide a general way for an author to decide which state values appear in the inventory/status surface and how they are labeled.

## Desktop/mobile parity

Desktop may support drag/drop.

Mobile must have an equivalent non-drag-only interaction, e.g. tap-select → tap destination/action.

The user will specifically test awkward/invalid inventory manipulation, so invalid actions must be meaningful authorable events rather than simply being impossible to attempt in the UI.

---

# 17. Inventory operation/event hooks

Inventory entries need general authorable operation hooks.

At minimum support the concept of events such as:

- inspect
- use
- move
- remove/discard/drop attempt
- successful remove/drop where allowed

An item/property can reject an operation but still produce authored output/effects.

This is critical: **do not merely set `removable=false` and suppress the gesture.** The author needs to be able to let the player try an invalid operation and have the game respond.

Each operation should support:

- conditions
- attempt-counter conditions
- output
- effects
- success/failure behavior

This same general mechanism should later be useful for cursed objects, locked objects, equipment restrictions, etc.; do not name/schema it around a single test case.

---

# 18. Floating notifications

Implement a generic notification effect suitable for transient feedback.

Required initial presentation:

- can originate near the text-entry/prompt region
- can float upward and out/fade
- does not become permanent terminal story text unless separately authored
- respects reduced-motion accessibility by using a non-moving equivalent

Notification text must be authorable and may interpolate variables.

The effect should be reusable for arbitrary state changes, not tied to any specific stat name.

---

# 19. Text performance system

All ordinary story output appears character-by-character by default.

The author asked for easy sentence-level performance authoring.

Keep **prose** separate from **performance metadata**.

A line should not become a pile of inline markup tags.

Implement/prepare structured performance cues capable of:

- default typing speed
- pause at an insertion point
- local speed-up/slow-down
- temporary wave
- temporary shake
- blink
- instant segment
- synth cue
- repo audio cue
- sprite/art cue

The UI should let the author select a word/range or cursor position and add a cue, with immediate preview.

Presets should exist for common timing behavior so authoring thousands of lines does not require hand-editing timelines.

Player accessibility must eventually support:

- adjustable speed
- instant text
- reduced motion
- mute/volume

Player input/tap should be able to complete the currently typing line immediately.

---

# 20. Tiny built-in synth

Binary/recorded audio belongs in Git, but the author wants to be able to create tiny flavor sounds from a phone while standing on a node.

Implement a deliberately limited browser synth whose definition is compact structured text stored in D1.

Initial target:

- 3 tonal voices
- 1 noise voice
- 16 steps maximum
- square / triangle / saw / sine
- pitch range roughly C2–C7
- volume
- attack
- release
- tempo
- loop yes/no

No DAW.

No plugin architecture.

No uploaded samples inside synth recipes.

The mobile editor should be tactile and simple enough to quickly create a chirp/jingle/noise cue and attach it to a sentence/event.

Web Audio synthesizes it locally.

---

# 21. Repository asset explorer

Repo binary assets should eventually be browseable from Author mode without runtime GitHub API calls.

Create a deterministic build-time asset manifest that can include useful metadata such as:

- relative path
- type
- file size
- content hash
- image dimensions where relevant

The author asset picker should feel like a small repo file explorer/searcher.

Asset links stored in D1 should reference manifest paths.

For sprites:

- native Sprite maximum = **32×32**
- smaller is fine
- pixel-preserving scaling
- larger special art is allowed but classified as general artwork, not Sprite

If a linked asset path is missing, Author mode should diagnose it. If the same content hash exists under another path, it may suggest a likely rename.

Released asset paths are immutable by convention: replace with a new path rather than overwriting a file that a public release used.

---

# 22. Author bookmarks / working locations

Author bookmarks are not ordinary player save files.

A bookmark should preserve enough testing context to resume work exactly:

- node
- actual traversal route
- play-state snapshot
- optional author note
- timestamp

The same node may behave differently depending on inventory/flags/variables, so node ID alone is insufficient.

Provide compact author access such as `/bookmark` and `/locations` plus touch-friendly UI.

---

# 23. Revision history / undo

Every durable author change should produce a revision record.

Revision history must be human-meaningful enough to understand actions such as:

- changed node text
- created interaction
- linked destination
- changed item rule
- changed condition/effect

Authoring should support practical Undo/History and safe recovery.

Do not rely on D1 Time Travel as the normal undo UI.

Current authenticated `backup` / `/backup` database export must remain working and should continue automatically including future tables.

The backup format should remain plausibly restorable later, but **do not add a destructive restore button casually**. If implementing restore, require deliberate safety design and explicit confirmation because it replaces canonical data.

---

# 24. Security / author authentication

Public users must never gain write access merely by discovering an admin route or frontend code.

Current model:

- user types `admin`
- client requests key
- POST `/api/author/login`
- Worker compares to private `ADMIN_KEY`
- Worker returns signed time-limited author token
- author API calls use `Authorization: Bearer ...`

Preserve server-side authorization for every author mutation/export.

Do not put `ADMIN_KEY` in the repo, frontend bundle, database, issue, PR, test fixture, or logs.

CORS should remain restricted to the real GitHub Pages origin and local development origins, not `*`.

---

# 25. Public vs Draft / release model

The long-term model is:

- author edits mutable Draft
- public players play an immutable published release snapshot

This milestone may continue using Draft as the only content while the game is private/early, but do not make schema choices that prevent release snapshots later.

Player saves should eventually bind to a release ID so future draft edits do not silently reinterpret an old save against incompatible world structure.

Do not spend the current milestone building a full release manager before the core authoring loop works.

---

# 26. Mobile/desktop design requirements

Every essential author operation must work on both.

Do not treat mobile as a scaled desktop screenshot.

Do not treat desktop as a stretched phone layout.

Equivalent mappings may differ:

- desktop contextual edit → right-click / modifier / click
- mobile contextual edit → long-press / author modifier
- desktop cascading navigator → sideward columns
- mobile navigator → nested sliding levels
- desktop inventory → drag/drop supported
- mobile inventory → tap-select/tap-place/action equivalent
- desktop autocomplete → keyboard arrows/tab where appropriate
- mobile autocomplete → large enough tappable rows

Touch targets can temporarily be more generous than literal DOS hitboxes in Author mode; public fiction should remain clean.

---

# 27. Author UI philosophy

The user prefers raw, legible structure over visual graph metaphors.

Do not over-design giant cards, dashboards, inspector sidebars, or endless modal forms.

Author information should be:

- dense
- local
- contextual
- ephemeral
- easy to dismiss
- structurally explicit

When possible, let the author start doing the thing first and infer the operation rather than forcing a mode-selection wizard.

Example principle:

> Typing should simultaneously mean “I may be creating something new” and “show me what existing thing this could connect to.”

The system should minimize the distance between:

**“I wonder what could happen here.”**

and

**“Now it happens.”**

---

# 28. General-purpose admin capabilities required for this milestone

The user's private acceptance scenario exercises a broad collection of mechanics. **Do not ask for or reconstruct that scenario.** Implement the following generic capabilities so the author can compose such a scenario manually:

1. create/edit node output in place
2. create free-text interactions from current node
3. add multiple aliases for an interaction
4. choose stay response vs transition
5. create new destination node
6. connect to existing destination via per-keystroke local search
7. display graph relationship notation in search/results/current branch
8. calculate accidental dead ends and distance locally
9. define and mutate numeric/boolean play-state variables
10. define read-only client-computed values based on safe runtime inputs
11. interpolate variables/computed values into authored output
12. define generic event/attempt counters without manual variable boilerplate
13. condition output/effects on first/subsequent/Nth attempts
14. create physical inventory item definitions
15. expose selected non-physical/computed/state values in the inventory/status experience
16. open inventory through authored/free-text command routing
17. support desktop drag/drop plus mobile-equivalent inventory manipulation
18. allow invalid inventory manipulation attempts to fire authorable event hooks
19. author different responses/effects based on repeated attempts
20. increment a countable player variable as an effect
21. show a transient floating notification as an effect, with interpolation support
22. keep all of those mechanisms generic and reusable
23. persist authored definitions to D1
24. keep runtime search/graph/state evaluation local where appropriate
25. make all of the above directly reachable from Author mode without source-code edits

This is the key completion standard. The author should be able to use raw/direct admin systems to construct a mechanically varied mini-sequence without asking you to add content-specific code.

---

# 29. Do not cheat the acceptance test

Do **not**:

- seed extra story content beyond the canonical opening
- add hard-coded commands for a private test scenario
- add variables/items/stat names that only make sense for that scenario
- special-case a particular inventory entry
- special-case a particular repeated action
- special-case a particular notification string
- put test story copy in React
- hide bespoke behavior behind generic-looking labels

Test fixtures/unit tests may use synthetic names/content inside test-only code, but production D1 seed data should remain minimal: canonical opening plus engine-owned metadata.

If you find yourself adding `if (name === "...")` for a story concept, stop and redesign the primitive.

---

# 30. Suggested data architecture

You may revise exact SQL normalization if you can justify it, but preserve canonical ownership and composability.

A reasonable direction is separate canonical records for:

- `nodes`
- `output_blocks` or node text/performance payloads
- `interactions`
- `interaction_aliases`
- `conditions` / condition trees or structured JSON per owner
- `effects` / ordered effect lists or structured JSON per owner
- `entities` with typed subrecords, or dedicated `items`, `characters`, `locations`
- `variable_definitions`
- `inventory_definitions` / item definitions
- `synth_sounds`
- `bookmarks`
- `revisions`
- later `releases`, `saves`

Avoid premature over-normalization if it makes author mutations cumbersome, but do not put the whole game into one opaque JSON row that prevents useful incremental sync/revisions/search.

Use explicit schema migrations.

Canonical story/state structures belong in D1, not duplicated in a source JSON file.

---

# 31. Client architecture direction

`src/App.tsx` is currently a tiny vertical slice and can be decomposed as systems grow.

Prefer clear modules such as:

- API/sync client
- IndexedDB project store
- project model/types
- parser
- graph index/analyzer
- condition evaluator
- effect executor
- play-state store
- text renderer/performance engine
- inventory engine/UI
- Author-mode contextual editors
- asset manifest/search
- synth engine/editor

Do not create a giant all-knowing React component.

Avoid runtime CSS patch layers. Put visual rules in coherent styles/components.

---

# 32. Testing expectations

Add tests where logic is deterministic and easy to regress.

At minimum, test:

## Parser

- normalization
- alias priority
- deterministic ambiguity handling
- fallback

## Graph

- dead node vs Ending
- dead-end distance
- traversal previous relationship
- branch shared-origin relationship
- cycles
- rejoins
- unreachable nodes

## Conditions/effects

- variable comparisons
- logical grouping
- ordered mutation
- event attempt counters
- first/subsequent attempt conditions

## Dynamic interpolation

- valid value references
- missing values fail safely
- no arbitrary code execution

## Inventory

- physical placement validity
- invalid manipulation event still fires hook
- repeated operation count behavior
- mobile-equivalent operation model can invoke same engine action as drag/drop

## Backup

- authenticated only
- includes new tables automatically

## Build

Keep these green:

```sh
npm run typecheck
npm run build:pages
```

PR CI must pass before claiming completion.

---

# 33. Deployment / verification expectations

Because the user has explicitly chosen set-and-forget hosting:

- do not require them to manually deploy each iteration
- use branch/PR workflow
- once merged to `main`, verify GitHub Pages workflow succeeds
- verify Cloudflare Worker deployment succeeds through its existing Git integration if observable
- verify the live Pages client can call the Worker API across CORS

The canonical player/author URL after Pages deployment is:

`https://natanai.github.io/pre-programmed/`

The Worker URL is an API endpoint, not the preferred player URL.

---

# 34. Definition of done for handoff milestone

Do not declare success merely because schemas/API routes exist.

The milestone is done when an authenticated author can, on both desktop and a mobile-sized viewport, use the actual live game/editor to do all of the following without editing source code or D1 manually:

- edit current story output in place
- create a new free-text interaction
- create aliases
- choose stay vs transition
- create a new node
- type text and see compact per-keystroke **local** existing-content matches immediately below it
- connect that interaction to an existing node
- see terse structural relationship notation
- see accidental dead-end diagnostics update without a network graph query
- define a numeric variable and mutate it from an interaction
- define/use a client-computed read-only value
- interpolate state/computed values into output
- define an interaction/operation with different behavior on first vs later attempts
- create an inventory item and configure its basic physical properties
- choose a state/computed property to show in the inventory/status view without making it a physical grid item
- open the graphical inventory from typed gameplay input
- attempt a disallowed inventory operation and have an authored response/effect run
- increment a countable state value
- emit a floating author-configured notification reflecting that change
- save all authored definitions to D1
- reload and retain the authored game
- download a complete authenticated D1 backup

If any one of those actions requires a story-specific code edit, the underlying authoring primitive is incomplete.

If the UI technically permits it but is too cumbersome to use from a phone while playing, the product requirement is incomplete.

---

# 35. Scope discipline / sequencing

This is a large milestone. Build in coherent vertical slices, but keep the final acceptance target above in sight.

Recommended order:

### Slice A — stabilize current PR #2

- verify Pages/API split
- verify auth
- verify node #1 D1 edit loop
- verify backup
- fix broken docs/references if found

### Slice B — local project model + graph + interactions

- project snapshot/delta API
- IndexedDB/cache
- local indexes
- interaction schema
- parser
- create/link flow
- per-keystroke local search
- graph notation/dead analysis

### Slice C — state / conditions / effects

- variables
- computed values
- condition editor/evaluator
- effect editor/executor
- interpolation
- event/attempt counters
- revisions/undo integration

### Slice D — inventory + event hooks + notifications

- item definitions
- state/nonphysical inventory display
- graphical inventory surface
- move/remove/use/inspect attempt hooks
- repeated-attempt conditions
- floating notifications
- mobile parity

### Slice E — media authoring foundations

- asset manifest/explorer
- text-performance structured cues
- synth recipe model + basic mobile editor
- attach media cues

If a later slice can be deferred without preventing the explicit definition-of-done, document that precisely. Do not silently omit a requested capability.

---

# 36. Communication with the user

The user wants to test the authoring system themselves rather than have you prebuild their content.

When you believe the milestone is ready:

- state exactly what is implemented
- state what branch/PR contains it
- give the live/test URL if available
- give a concise manual test route that starts from the canonical opening and demonstrates how to access each **generic** author system
- do not give them a pre-authored story recipe
- do not claim something works on mobile unless you actually checked responsive/touch behavior or clearly state the limitation
- call out any remaining missing capability that would prevent the author from freely composing arbitrary content

The final question you should be able to answer “yes” to is:

> Can the user now discover whether Pre-Programmed is fun to build by simply playing it and authoring whatever occurs to them, rather than by asking a programmer to encode each new mechanic?

That is the purpose of this milestone.
