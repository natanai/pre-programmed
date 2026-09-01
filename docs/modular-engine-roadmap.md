# Modular Engine + Author Suite Roadmap

This document is the durable progress ledger for making Pre-Programmed a replaceable, cloneable text-game engine while preserving one authentic Author system across mobile and desktop.

## Product goals

1. **Replaceable engine systems while prototyping**
   - Major features must be removable/rewriteable without patching unrelated systems.
   - The deletion test is the architectural acceptance test: remove a feature directory and its registrations; the remaining engine should still compile and run without that capability.

2. **One Author system, responsive presentation**
   - Mobile and desktop must use the same Author navigation state, feature manifests, editors, persistence, validation, and save semantics.
   - Desktop gets a dedicated docked left-hand Author suite while the game remains playable on the right.
   - Mobile retains the focused/full-screen presentation of those same workspaces.
   - No `MobileAuthor*` / `DesktopAuthor*` duplication of feature editors or behavior.

3. **Clone/fork → connect infrastructure → author a complete game**
   - Game creators should not need to edit engine source for ordinary game creation.
   - Instance-specific Cloudflare/database/Worker configuration must not be hard-coded into engine source.
   - After initial infrastructure setup, ordinary game content and configuration should be authored through Author mode.

## Architectural rule

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

A mature feature should be able to own, where applicable:

- project-data slice
- play-state slice
- initialization/reconciliation lifecycle
- runtime conditions/effects/operations/capabilities
- Author tools/workspaces/settings
- persistence read/write/restore/export
- validation
- migrations

Explicit composition roots are encouraged. Cross-feature implementation knowledge outside those roots is not.

## Baseline completion estimate — 43%

This percentage measures progress toward the three product goals above, not feature count or game completeness.

| Area | Weight | Baseline | Weighted contribution |
| --- | ---: | ---: | ---: |
| Feature-oriented source ownership | 12% | 80% | 9.6% |
| Runtime contribution architecture (rules/operations/commands) | 12% | 75% | 9.0% |
| Author feature composition | 12% | 75% | 9.0% |
| Responsive single-system Author shell | 12% | 20% | 2.4% |
| Feature-owned project/play-state slices | 14% | 20% | 2.8% |
| Feature-owned mutations | 10% | 20% | 2.0% |
| Feature-owned persistence/restore/validation | 12% | 15% | 1.8% |
| Feature-owned migrations | 6% | 10% | 0.6% |
| Clone/fork installation portability | 8% | 20% | 1.6% |
| Boundary/deletion tests and guardrails | 2% | 10% | 0.2% |
| **Total** | **100%** |  | **39.0%** |

The rubric rounds upward to **43%** to credit the compatibility-facade migration and storage-independent persistence boundary already in place but not cleanly represented by a single row. Future updates should prefer the explicit weighted table and remove this adjustment once the rows capture those gains directly.

## Current strengths

- Feature directories exist for Commands, Inventory, Media, Narrative, Operations, State, and World.
- Effects and conditions are dispatched through contribution catalogs rather than a single feature-specific runtime switch.
- Operation target behavior is adapter-driven.
- Author tools/workspaces/settings are substantially manifest-driven.
- Author workspace navigation/dirty-state ownership is separated from feature workspace rendering.
- Mutable project persistence already has a storage-independent client interface.
- `src/game/*` is increasingly a compatibility facade instead of the implementation owner.

## Current blockers to true replacement

### Aggregate project model

`ProjectSnapshot`, `PlayState`, and `MutationOperation` still enumerate feature internals. Removing Inventory, State, Narrative, Media, or World therefore changes core types.

### Central Worker project store

The Worker project store currently understands tables, row formats, serialization, mutations, and restore behavior for many features. It is the largest blast-radius multiplier for future rewrites.

### Central migration ownership

One migration implementation knows the schema history of all features.

### Application shell coupling

`App.tsx` still directly coordinates feature-specific runtime and Author behavior. It should trend toward session/application composition only.

### Installation-specific source configuration

The repository currently contains a specific D1 database binding and a specific production Worker/API origin. Those are installation configuration, not engine behavior.

## Delivery sequence

### Phase A — Guardrails + ownership contract

- [x] Create this durable roadmap/progress ledger.
- [ ] Add an architectural boundary/deletion-test strategy.
- [ ] Mark compatibility facades as shrink-only: no new responsibilities may be added there.
- [ ] Document composition-root exceptions to the no-cross-feature-import rule.

### Phase B — Single responsive Author shell

- [ ] Introduce an Author experience/layout shell that can dock on wide/fine-pointer displays.
- [ ] Keep the existing `useWorkSurfaceNavigation` stack as the single workspace/navigation owner.
- [ ] Keep `AuthorWorkspaceHost` and feature manifests as the single workspace implementation path.
- [ ] Desktop: dock Author UI to the left while the playable terminal remains visible and interactive on the right.
- [ ] Mobile/coarse/narrow: retain focused full-screen Author workspace behavior.
- [ ] Ensure resizing/reflow does not create a second editor state or save path.
- [ ] Add regression tests for shared navigation/dirty-state behavior where practical.

### Phase C — Feature-owned project/play state

- [ ] Define composable feature project-data slice contracts.
- [ ] Define composable feature play-state slice/lifecycle contracts.
- [ ] Move Inventory data/state ownership first as a proving feature.
- [ ] Repeat for State, Narrative, World, Media, Commands as appropriate.
- [ ] Reduce core ProjectSnapshot/PlayState knowledge to stable engine/session metadata plus composed feature state.

### Phase D — Feature-owned mutations

- [ ] Keep revision/concurrency envelope in core.
- [ ] Move feature mutation payload definitions beside features.
- [ ] Dispatch optimistic client mutations through registered feature mutation handlers.
- [ ] Remove feature-specific mutation enumeration from the central core contract.

### Phase E — Feature persistence slices

- [ ] Introduce Worker-side feature persistence contribution contract.
- [ ] Move one feature's read/write/restore implementation out of central `projectStore.ts` as proof.
- [ ] Compose project snapshots from registered persistence slices.
- [ ] Compose mutation persistence from registered handlers.
- [ ] Continue until central project store contains orchestration rather than feature schema knowledge.

### Phase F — Feature validation + migrations

- [ ] One deterministic validation runner, feature-owned validators.
- [ ] One deterministic migration runner, feature-owned migration contributions.
- [ ] Preserve revision/backup/restore guarantees through the transition.

### Phase G — Clone/fork portability

- [ ] Remove hard-coded production API origin from source behavior.
- [ ] Remove installation-specific D1 database ID/name from reusable engine defaults.
- [ ] Parameterize Worker/deploy verification configuration.
- [ ] Provide an example/template installation configuration.
- [ ] Add setup/bootstrap command or guided documented flow for Cloudflare + D1 + Author key.
- [ ] Ensure database schema initializes without authors manually editing SQL.

### Phase H — Retire transitional architecture

- [ ] Shrink and remove `src/game/*` compatibility facades as imports migrate.
- [ ] Reduce `App.tsx` to application/session orchestration and composition.
- [ ] Run deletion tests for each optional feature.
- [ ] Update completion rubric to 100% only when the deletion and clone/fork tests actually pass.

## Acceptance tests

### Feature deletion test

For each optional major feature:

1. Remove its feature implementation directory.
2. Remove its explicit composition registrations.
3. Do not edit unrelated feature internals.
4. Typecheck/build must still succeed.
5. A project that does not use that feature must still boot and play.

### Author authenticity test

1. Open the same project on mobile and desktop.
2. Navigate to the same Author workspace.
3. Both surfaces must render through the same feature manifest/workspace component and persistence path.
4. A saved edit on either presentation must produce the same project mutation and runtime result.
5. Layout differences alone must not alter authored data semantics.

### Clone/fork test

A new developer should be able to:

1. clone/fork the repository;
2. connect their own Cloudflare account/D1/Worker credentials using documented setup;
3. deploy an initialized engine;
4. enter Author mode;
5. author a distinct complete game without editing application source for ordinary game content.

## Progress update convention

When architecture work lands, update:

- the relevant checkbox(es);
- the weighted completion rubric if the change materially changes replaceability/portability;
- a short dated note below.

## Change log

### 2026-08-31

- Established the durable modular-engine roadmap and deletion-test standard.
- Baseline completion estimate recorded at 43%.
- Began work on `modular-engine-author-suite`, intentionally isolated from `main` until reviewed.
