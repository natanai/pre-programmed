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

Queries emit JSON. The node argument is an exact source-location ID (replace the illustrative coordinate with a real one from --find). Node source positions can change after edits; compare declared_id, workspace, and source context to reconcile them. The [graph workflow](../../.github/workflows/author-flow-graph.yml) detects drift in relevant PRs. It warns without blocking unrelated development, and requires an up-to-date graph for audit-specific PRs.

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
