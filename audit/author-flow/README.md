# Author flow graph: evidence, not interpretation

This folder is an **audit-only record**. It does not modify Player or Author UI, create an editor, or change persistence.

## Why a directed graph?

The interface includes loops, conditional choices, nested task returns, resource-dependent branches, and unbounded project text. There is no finite universal tree of all possible screens. Model observed **states** connected by **interactions** instead.

## Evidence layers

**Generated source declarations** are in [source-graph.json](source-graph.json), produced by [extract.mjs](../../scripts/author-flow/extract.mjs) using the TypeScript AST. It records control declarations, UI option literals/dynamic expressions, conditional guard expressions, explicit if/ternary/short-circuit/switch branch sites, dynamic collection sites, callback source, nested controls, and task/resource API call sites across Author, feature, engine, player, terminal and Author-settings support source. Entries include source file and line/column. This is deterministic and has no guessed author goals, quality ratings, or imagined transitions.

**Executed transitions** conform to [observed-schema.json](observed-schema.json). [browser-recorder.js](../../scripts/author-flow/browser-recorder.js) is a passive capture helper for a dedicated test browser. Each state records the currently visible controls and task trail; each transition records an actual click/change and its subsequent visible state. The recorder does not explore branches by itself, inspect internal React state, or change the game. A DOM snapshot does not certify persistence succeeded.

[coverage.json](coverage.json) is generated from the source graph and committed executed traces (if any). Its runtime completeness field is null rather than a fabricated percentage. **There are zero claimed executed transitions in the initial source baseline.** A declared callback is not an observed click-to-screen edge. Dynamic collections are not invented into concrete instances.

## Commands

    npm ci
    npm run audit:author:extract
    npm run audit:author:check
    npm run audit:author:coverage
    npm run audit:author:coverage-check
    npm run audit:author:query -- --find 'world-character-alias'
    npm run audit:author:query -- --api 'pushTask' --limit 20
    npm run audit:author:query -- --branch 'world-character'
    npm run audit:author:query -- --collection 'map'
    npm run audit:author:query -- --node 'src/author/EffectsEditor.tsx:1:1'

Queries emit JSON. The node argument is an exact source-location ID (replace the illustrative coordinate with a real one from --find). Node source positions can change after edits; compare declared_id, workspace, and source context to reconcile them. This audit is **on demand**; it no longer has GitHub Actions. Run the local commands when the graph is needed. Do not enable automatic graph rebuilding or browser traversal as part of ordinary game development.


## Lightweight declared navigation model (no browser)

[Navigation model JSON](navigation-model.json) is produced from the existing TypeScript AST inventory plus the real feature-owned resource-provider and workspace declarations. It **does not open a browser, run the game, invoke handlers, mutate project data, or add CI**.

```sh
npm run audit:author:extract
node scripts/author-flow/navigation-model.mjs
node scripts/author-flow/navigation-model.mjs --check
```

The model contains four complementary kinds of source evidence:

- **Direct handler declarations:** a known Author workspace calls `pushTask` / `openTask` with an explicit route. Computed route calls remain `unresolved`.
- **Canonical resource providers:** actual manifest-owned kinds and their `listRoute`, `createRoute`, and `editRoute`. An unresolved helper stays null. Provider routes are owner-owned, not duplicate editors.
- **Contextual resource fields:** literal `ReferenceField` and declarative resource controls in named workspaces, joined to the provider's canonical Create route. Dynamic kinds, source locations not linked to a workspace, and missing create routes are not silently fabricated.
- **Route/workspace bindings:** a source-declared `defineAuthorWorkspace` `matches()` associates a feature route with a workspace definition. Extra route-data predicates are explicitly marked; a binding is not a successful runtime transition.

### Queries for the two reference games

```sh
# Dating visual novel: while editing a Node, find the Character creation route
node scripts/author-flow/navigation-model.mjs --from narrative.node --create character

# RPG: while editing a Node, find the Location creation route
node scripts/author-flow/navigation-model.mjs --from narrative.node --create location

# A candidate two-level nest: Node -> Character editor -> portrait Media editor
node scripts/author-flow/navigation-model.mjs --path --from narrative.node --to media.vector-asset --via character

# Existing direct route, without assuming UI click counts
node scripts/author-flow/navigation-model.mjs --from narrative-structure --to narrative.node

# Search all navigation, reference, resource, and workspace-binding evidence
node scripts/author-flow/navigation-model.mjs --find media-image
```

The `--path` query uses ordinary graph traversal, following **only** declared task-opening and route-to-workspace edges, with a zero-action association for a workspace matcher. The optional `--via` filter is enforced by actual path traversal. It returns the number of **source-declared task-opening invocations** along a candidate path, not a measured click minimum, not an exact sequence of player inputs, and not proof that any child was saved or returned correctly.

The shared `ReferenceField` has two source-declared entry branches: **one pointer activation** can open Create directly when nothing is selected and no options exist; otherwise opening its chooser and selecting Create requires **two**. These are conditional subpaths, not universally guaranteed actions. The path JSON leaves `pointer_actions: null` because the actual rendered controls, content-dependent conditions, dirty-draft handling, and save/return behavior are not statically certified.

The useful next step is to expose more of the owning resource/task contracts as **structured navigation decisions** so this graph can describe larger play → author → nested create → parent → play sequences with fewer unresolved edges. Check the real browser only at selected checkpoints where source/engine contracts cannot prove visual behavior or persistence. Do not turn these queries into automated browser exhaustions or new GitHub Actions.

## Deterministic observation protocol

1. Declare each fixture: source commit, project identifier and content SHA-256, current Player state, task stack and draft state when inspectable, fixed clock and seed, viewport and input modality. Use disposable fixtures, not real user data.
2. Reset to the identical fixture before executing each branch. Capture the initially visible controls, their enabled state, and every finite select/choice option. Disabled controls are data too.
3. Perform exactly one action, await an explicit settling condition, record the next visible state. Visit newly discovered states and their applicable actions. Preserve modal, loading and error states rather than inferring successful completion.
4. Explicitly enumerate finite input domains in the fixture. Text, list length, nested depth, and project data are unbounded. Mark unexplored alternatives in the frontier as unvisited, unbounded-input, requires-fixture, unsafe-mutation, or other defined reason. An empty frontier does not prove global completeness.
5. Record real input events. Physical pointer click counts, keyboard actions and typed characters are separate observations. Do not estimate a click count from source.
6. Run comparable fixtures on desktop and mobile. The route, resource owner, save path and task semantics should match even when layout changes.
7. Link observations to source control IDs when available; do not manufacture source links for unknown DOM controls.

## Interpretation limits

- **Source coverage** means AST declarations found; it does not mean the controls render.
- **UI-state coverage** means an actual screen with a particular fixture was observed.
- **Transition coverage** means an action actually executed from that exact state.
- **Unknown** means nothing observed. Never claim complete runtime flow coverage by dividing executed edges by source declarations; those measure different things.

For questions about a control, query the declaration first. If a matching executed transition for the required state and fixture exists, follow it; otherwise report **not observed** and expose the declared callback. Keep proposed UX changes in separate discussions/issues, never inside raw audit JSON.

## Executed browser exploration (first bounded capture)

The [browser explorer](../../scripts/author-flow/explore.mjs) starts the **actual client and local Cloudflare Worker/D1** through the existing local launcher, deletes its dedicated `.wrangler/author-flow-audit` database before and after running, and seeds a deterministic authored Character, Location, Flag, numeric Variable, Group, and terminal Valid Input. It never accesses production.

The browser uses real Chromium pointer/select interactions. It starts fresh browser contexts for each action path, replays all preceding interactions from the same fixture, records the UI state before and after every action, and collects newly reached states breadth-first. Browser-recorder V2 does not guess a click's previous state from a post-change event; the explorer records explicit boundaries.

Run using a Playwright installation in an **isolated development/test environment**, never in a production bundle:

    npm install --no-save --no-package-lock playwright@1.56.1
    npx playwright install chromium
    npm run audit:author:explore -- --max-states 45 --max-depth 4
    npm run audit:author:coverage

Use `--viewport desktop` or `--viewport mobile` to restrict captures; the default runs both. The [browser audit workflow](../../.github/workflows/author-flow-browser.yml) installs Chromium and its system libraries separately from the engine's normal dependencies, runs the explorer against isolated D1, verifies project build/tests, and commits its observed traces to the audit branch.

**The first explorer intentionally does not execute persistent/destructive controls**, nor guess values for free text. They are preserved in the frontier as `unsafe-mutation` and `unbounded-input`. This is a *safe observed baseline*, not exhaustive logical coverage of all project definitions or actions. The remaining branches require explicit disposable reset contracts before broad mutation traversal is appropriate.

**Important determinism boundary:** the captured states describe observable controls and labels, not full in-memory React drafts or player internals. Equal screen signatures can hide distinct internal states. The trace accurately says `draft_state.observed=false` and `run_state.observed=false`. Do not interpret state-ID equality as proof of identical project state or player semantics. Source hash and fixture SHA, browser version, and bounded exploration parameters should be retained for comparing runs.

The progress ledger in `coverage.json` counts only saved executed fixtures/states/edges. An agent can reproduce the trace or extend the explicit frontier without supplying any imaginary author goals.

Query the **executed** graph separately from source declarations:

    npm run audit:author:trace -- --fixture desktop
    npm run audit:author:trace -- --fixture mobile --find 'Character'
    npm run audit:author:trace -- --fixture desktop --state 'state:...'
    npm run audit:author:trace -- --fixture desktop --from 'state:...' --to 'state:...'

The last command runs breadth-first search over only **observed edges** and reports the shortest recorded action sequence and actually instrumented pointer activations. It does **not** invent transitions through unobserved UI states. The recorded mobile fixture uses Chromium mobile emulation with touch and a 390×844 viewport. Fixture clock and runtime random seed are explicitly marked uncontrolled where they have not been frozen.

## Distinct exploration schedules and replay-certified paths

The original `author-audit-desktop.json` and `author-audit-mobile.json` remain unchanged. A second schedule (`--suite wide --strategy stratified`) saves separate `author-audit-desktop-wide.json` and `author-audit-mobile-wide.json` traces. Stratification rotates among **recorded interaction prefixes** to distribute a finite browsing budget across branches. It does not classify developer intentions or prefer an authored feature. All schedules remain partial; their unexplored frontier is preserved.

    npm run audit:author:explore -- --suite wide --strategy stratified --max-states 80 --max-executions 110 --max-depth 4
    npm run audit:author:coverage
    npm run audit:author:trace -- --fixture desktop-wide
    npm run audit:author:trace -- --fixture mobile-wide --find 'CHARACTER'

New browser traces also include the actual initial UI state, completed **contiguous browser replays**, and the selected value for each unvisited finite selector alternative. Older traces remain valid evidence of individual edges but do **not** have replay sequence provenance. For those older traces, the path query correctly returns **sequence not verified**, rather than linking separate edges merely because visible screen fingerprints happen to be identical.

For newer traces, `--from` and `--to` return the shortest action subsequence **observed together in a single completed replay**, not an invented shortest path over the union graph. The fingerprint excludes internal draft and Player state, so equal visible states are not proof that arbitrarily composed actions will work. These queries cannot prove that an unseen path is impossible.

The generated `coverage.json` includes per-fixture and per-workspace **observed** state counts, transitions, and frontier reasons. Those are raw coverage inventories, not success rates, inferred goal completion, or a fraction of the engine's unbounded state space. All generated traces come exclusively from isolated local fixtures, never from the live project.


## Scroll-revealed controls (separate evidence suite)

The `--scroll` explorer option adds **actual browser wheel interactions** to the otherwise identical bounded Author UI traversal. The recorder inventories pointer-reachable vertical scroll regions where rendered CSS permits scrolling and the content exceeds the viewport. Each recorded UI state includes scroll container locator, observed scroll offset, maximum scroll offset, and visible client height. Scroll transitions record a signed requested wheel delta with zero pointer *activations* (a wheel is not a click). Subsequent screenshots/state snapshots, not predictions, determine which controls become exposed.

    npm run audit:author:explore -- --suite scroll --strategy stratified --scroll --max-states 55 --max-executions 75 --max-depth 5
    npm run audit:author:trace -- --fixture mobile-scroll --find 'author-panel-body'
    npm run audit:author:trace -- --fixture desktop-scroll

Traces are kept in `author-audit-{desktop,mobile}-scroll.json`; original breadth and wide traces are not overwritten. The trace validator checks that the target region was actually recorded as scrollable and that the requested wheel direction was within its known boundaries. The coverage ledger reports the observed number of scroll actions separately from ordinary clicks/select changes. Individual replay sequences still provide proof of the full before/scroll/after chain.

**Scope limits:** this pass observes wheel scrolling on a mobile-emulated viewport, not an actual finger swipe gesture on iOS Safari. Horizontal scrolling and automatic focus-triggered scrolls also remain outside this suite. The recorder only knows currently rendered content and does not infer invisible controls. No project data is persisted during the traversal.

## Finite text-entry and durable Save evidence

A separate `--writes` audit suite exercises **the real Node editor and its owning Save action** against three explicit text samples: a short ASCII sentence, punctuation, and empty text. It operates on a dedicated D1 database freshly reset and re-seeded **for every single value and viewport**. The input domain is deliberately finite and declarative; it does not describe or assume developer intentions.

    npm run audit:author:explore -- --writes --viewport both
    node scripts/author-flow/validate-traces.mjs
    npm run audit:author:coverage
    npm run audit:author:trace -- --fixture desktop-write-ascii
    npm run audit:author:trace -- --fixture mobile-write-empty

Each trace is a contiguous, executed browser sequence: open the canonical Node workspace → enter a finite narration text with Playwright `fill` → click the enabled canonical [SAVE]. The text change is marked `event: "fill"` with **zero counted pointer clicks**; it is not counted as a measured number of keyboard keystrokes. Saving is marked as a separate, observed click.

A persisted Save transition contains the previous and new snapshot SHA-256 hashes, D1 revision numbers, the exact authored field and expected/read-back value, and evidence that restarting the isolated Worker **retained exactly the same serialized project snapshot and field value**. The validator requires a verified revision increase and a matching post-restart hash. Neither an on-screen notification nor a pending save alone counts as durability evidence.

No production project, real user data, or Author-only persistence path is involved. Each test case starts from the engine's normal seeded project and uses the real workspace editor and its existing persistence contract. Other editable resources, dependent resources, invalid inputs, unsaved navigation and broader input strings remain explicitly outside this finite case suite. The existing breadth, wide, and scroll traces remain unchanged.

## Dirty draft, Back, master X, and nested task navigation

A separate `--draft-navigation` suite records four **literal browser interaction sequences** on disposable, freshly seeded D1 projects, independently on desktop and mobile. It observes navigation and the canonical save path without adding any Author-only editor or mutation mechanism.

    npm run audit:author:explore -- --draft-navigation --viewport both
    node scripts/author-flow/validate-traces.mjs
    npm run audit:author:coverage
    npm run audit:author:trace -- --fixture desktop-navigation-close-save-all

The four finite sequences are **close-keep-discard**, **close-save-all**, **nested-parent-return**, and **dirty-child-back**. These labels identify the executed procedures, *not* hypothetical user goals. The runner uses the real Node narration textarea, real nested Author Tools and Structure panels, real [← BACK] and master [X], and the existing alertdialog buttons.

Every trace stores the actual before/after visible controls, step ordering and proof that the project is unchanged after discard (or changed after Save All). It verifies both the project's exact SHA-256 and its Node narration value **after a local Worker restart**. The nested parent case also records the narration field's actual value when its suspended task resumes. The nested child case attempts Back from a Node opened through Structure. If Back is actually presented, it records dirty confirmation, Keep Editing, a second Back, Discard Changes and return. If the task stack instead resets and Back is unavailable, it records the **observed before/after task depths**, the absent Back control, and an explicit unexplored frontier entry. It then exits through the real master X and Discard All without inventing a Back transition.

Only the `close-save-all` case is expected to persist a project mutation. Every other case must have identical project content and revision before and after navigation; the validator rejects discrepancies. This is a finite fixture suite: it does not assert that all resources, all nested drafts, all save combinations or arbitrary input values have been covered.


## Replay previously unexplored finite controls (frontier continuation)

The original browser explorer can also replay recorded `unvisited` actions from a named existing trace. It does **not** regenerate imaginary pathways from source declarations. It finds the shortest *contiguous, completed browser replay* that ended in the recorded frontier origin state, appends the literal unvisited action and executes that entire sequence again on a disposable D1 fixture. Each successful click/change/scroll is newly observed. Input strings and destructive/persistent actions continue to require separately controlled test domains.

    npm run audit:author:explore -- --resume-from scroll --suite frontier --strategy stratified --scroll --max-states 95 --max-depth 7 --max-executions 120
    node scripts/author-flow/validate-traces.mjs
    node scripts/author-flow/frontier-progress.mjs --source scroll --suite frontier
    node scripts/author-flow/measure.mjs
    npm run audit:author:coverage

The prior fixture's SHA-256 and viewport must match the new fixture. The continuation keeps the prior trace immutable. `frontier-progress.json` reports a source entry as **verified-executed only when its exact source state ID and action appear as an actually executed new transition**. Entries not meeting this threshold remain `not-verified`, even when similar actions executed in different UI states. Entries that were never replayable from a completed earlier path remain unproven, not impossible. The finite run budget makes this a *frontier-reduction pass*, not proof that every option has been exhausted. To resume again, use a separately named input suite and output suite, preserving the previous traces.

## Objective Author navigation costs, without a goal model

`scripts/author-flow/measure.mjs` produces `access-costs.json` from complete, replay-certified sequences only. For each fixture and reached workspace, it records the smallest **observed** prefix from a terminal screen with Author already enabled, ranked first by physical pointer activations and then by total discrete interactions. It separately records scrolling, selections, task depth, and whether a form field, Save control, and Back control were actually visible on arrival.

This measures *access to an observed workspace*, **not** time spent deciding, success at authoring, a globally shortest route, or fun. A visible form field is not proof of a completed edit, and a visible Save is not persistence evidence. Use the existing independent D1 write traces for verified durable Save claims. Comparing identical fixture endpoints across revisions can establish whether a proposed interface change reduced verified input/navigation costs without inserting any invented author intention into the raw trace. For author-to-player round trips, resource-specific persistence, and end-to-end creation costs, gather complete, separately reset browser fixtures first; do not extrapolate from navigation-only evidence.

### Recorder fingerprint changes and literal path evidence

Older traces may have a different visible-state hash from a new recording because the passive recorder learned to include additional on-screen controls (for example, a master X outside the task portal). **Do not report a hash mismatch as a failed browser replay or falsely infer that old states are identical.**

`frontier-progress.json` uses the strict older-state-and-action identity test. Its exact hit count can legitimately be zero across recorder changes. `sequence-progress.json`, produced with `node scripts/author-flow/sequence-progress.mjs --source scroll --suite frontier`, separately compares *complete actual ordered interaction sequences* from identical disposable project snapshots. It records whether the same path was executed in the current browser, the actual new source/destination hashes, and whether those hashes changed. It does not mark the old state itself verified when fingerprints differ. The two evidence tiers cannot be added together as unique states.

Do not interpret the raw `coverage.json` sum of all fixture frontier entries as a monotonically decreasing outstanding-work counter: separately seeded observations can expose further branch alternatives and preserve historic unresolved records. Only compare a named source fixture's finite action domain against its actual continuation outcomes.

### Raw choice exposure is distinct from click distance

`node scripts/author-flow/choice-load.mjs` deterministically produces `choice-exposure.json` from actually displayed UI states. It counts enabled direct controls, finite dropdown alternatives, toggles, text fields, and rendered scroll regions separately, then reports descriptive min/median/p90/max per fixture and workspace. A dropdown alternative is not counted as a simultaneously visible button, and this data makes **no claim about cognitive load**. This avoids mistaking a two-click route into a 30-choice editor for a fully measured creative workflow.
