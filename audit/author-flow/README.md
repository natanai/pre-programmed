# Author flow graph: evidence, not interpretation

This folder is an **audit-only record**. It does not modify Player or Author UI, create an editor, or change persistence.

## Why a directed graph?

The interface includes loops, conditional choices, nested task returns, resource-dependent branches, and unbounded project text. There is no finite universal tree of all possible screens. Model observed **states** connected by **interactions** instead.

## Evidence layers

**Generated source declarations** are in [source-graph.json](source-graph.json), produced by [extract.mjs](../../scripts/author-flow/extract.mjs) using the TypeScript AST. It records control declarations, UI option literals/dynamic expressions, conditional guard expressions, callback source, nested controls, and task/resource API call sites across Author and feature source. Entries include source file and line/column. This is deterministic and has no guessed author goals, quality ratings, or imagined transitions.

**Executed transitions** conform to [observed-schema.json](observed-schema.json). [browser-recorder.js](../../scripts/author-flow/browser-recorder.js) is a passive capture helper for a dedicated test browser. Each state records the currently visible controls and task trail; each transition records an actual click/change and its subsequent visible state. The recorder does not explore branches by itself, inspect internal React state, or change the game. A DOM snapshot does not certify persistence succeeded.

**There are zero claimed executed transitions in the initial source baseline.** A declared callback is not an observed click-to-screen edge. Dynamic collections are not invented into concrete instances.

## Commands

    npm ci
    npm run audit:author:extract
    npm run audit:author:check
    npm run audit:author:query -- --find 'world-character-alias'
    npm run audit:author:query -- --api 'pushTask' --limit 20
    npm run audit:author:query -- --node 'src/author/EffectsEditor.tsx:1:1'

Queries emit JSON. The node argument is an exact source-location ID (replace the illustrative coordinate with a real one from --find). Node source positions can change after edits; compare declared_id, workspace, and source context to reconcile them. The [graph workflow](../../.github/workflows/author-flow-graph.yml) detects stale source files in relevant PRs.

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
