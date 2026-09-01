# Modular Engine + Author Suite Roadmap

This is the durable progress ledger for making Pre-Programmed a replaceable, cloneable text-game engine while preserving one authentic Author system across mobile and desktop.

## Product goals

1. **Replaceable engine systems while prototyping** — a major feature should be removable/rewriteable without patching unrelated systems.
2. **One Author system, responsive presentation** — desktop and mobile use the same navigation, editors, mutations, persistence, validation, and save semantics; only presentation changes.
3. **Clone/fork → connect infrastructure → author a complete game** — ordinary game creation should happen through Author mode rather than source edits.

## Architectural rule

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

A mature feature may own project data, play state, lifecycle, conditions/effects/operations, Author UI, mutations, persistence, validation, presentation contributions, and future migrations. Explicit composition roots are encouraged.

## Current completion estimate — about 77%

This percentage estimates progress toward the architecture/product goals above, not game completeness. The baseline at the start of this pass was about 43%.

| Area | Weight | Current | Weighted |
| --- | ---: | ---: | ---: |
| Feature-oriented source ownership | 12% | 92% | 11.04% |
| Runtime contribution architecture | 12% | 95% | 11.40% |
| Author feature composition | 12% | 88% | 10.56% |
| Responsive single-system Author shell | 12% | 45% | 5.40% |
| Feature-owned project/play-state ownership | 14% | 75% | 10.50% |
| Feature-owned mutations | 10% | 90% | 9.00% |
| Feature persistence/restore/validation | 12% | 90% | 10.80% |
| Feature-owned future migrations | 6% | 50% | 3.00% |
| Clone/fork installation portability | 8% | 45% | 3.60% |
| Boundary/deletion guardrails | 2% | 85% | 1.70% |
| **Total** | **100%** |  | **77.00%** |

The working estimate is therefore **about 77% architecture completion**. Code-side merge readiness is substantially higher than architectural completion: GitHub Actions passes dependency installation, TypeScript typecheck, the full Vitest suite, and production build. The responsive Author shell now needs real-client use, so the current branch is intended to merge as a **client-validation checkpoint**, not as a declaration that modularity or installation work is finished.

## What changed in this pass

### Feature boundaries and compatibility

- [x] Durable feature-boundary rules exist in `docs/feature-boundaries.md`.
- [x] `src/game/*` is explicitly shrink-only compatibility architecture.
- [x] The old `src/game/model.ts` lost real Inventory/State initialization behavior and now re-exports the canonical engine lifecycle.
- [x] Architecture regression tests cover composition roots, persistence dependency ordering, and optional-feature Author route boundaries.
- [x] Added a branch-safe GitHub Actions validation workflow that never deploys or uses production secrets.
- [x] GitHub CI passes typecheck, the full test suite, and production build on the architecture branch.
- [x] Optional Inventory/Media Author workspaces route through generic feature routes rather than expanding central navigation types.
- [ ] Add true compile/build feature-deletion checks.

### Project/play-state ownership

- [x] Narrative owns its project/play-state field slices.
- [x] Inventory owns its project/play-state field slices.
- [x] State owns its project/play-state field slices.
- [x] World owns its project-data slice.
- [x] Media owns its project-data slice.
- [x] Commands owns its play-state slice.
- [x] `ProjectSnapshot` and `PlayState` are composed from feature-owned slices while retaining the existing flat runtime shape for compatibility.
- [x] Narrative, State, Inventory, and Commands own their play-state initialization/reconciliation contributions.
- [x] Commands owns its project-settings defaults/normalization and Worker validation while the persisted `settings.commands` shape remains unchanged.
- [x] Project-change reconciliation is generic at the application boundary rather than App calling Inventory lifecycle behavior directly.
- [x] Timed State progression contributes through a generic project-clock composition root; App and saved-location UI no longer know State timer semantics.
- [ ] Prove physical deletion of an optional feature with a build/test run.

### Rules, presentation, and mutations

- [x] Feature leaf condition/effect payload types moved beside Inventory, State, Narrative, and Media.
- [x] Engine Rules owns recursive/generic condition composition rather than feature leaf semantics.
- [x] Feature mutation payload types moved beside Narrative, World, State, Inventory, and Media.
- [x] Optimistic mutation application dispatches through feature-owned handlers instead of a central feature switch.
- [x] Revision/concurrency remains core-owned.
- [x] Media owns its effect-event payloads and browser presentation semantics for notifications, synth, audio, and art.
- [x] Media-owned text-performance cue extensions are composed through a generic cue-event boundary instead of Narrative hardcoding Media behavior.
- [x] Browser-only presentation composition lives outside Engine/Worker compilation.

### Worker persistence

- [x] Added one `WorkerFeaturePersistence` contract.
- [x] Narrative owns node/interaction/start-node D1 loading, mutation SQL, reset, and restore contributions.
- [x] World owns entity D1 loading, mutation SQL, hooks, reset, and restore contributions.
- [x] State owns variable/computed D1 loading, mutation SQL, hooks, reset, and restore contributions.
- [x] Inventory owns item D1 loading, mutation SQL, hooks, reset, and restore contributions.
- [x] Media owns synth D1 loading, mutation SQL, reset, and restore contributions.
- [x] `worker/projectStore.ts` is now a core orchestrator rather than a feature SQL warehouse.
- [x] Reset and restore order are separate explicit composition concerns so foreign-key dependencies are deterministic.
- [x] Bookmarks restore after Narrative nodes so their node foreign keys are valid.
- [x] Existing API/backup/migration tests pass after the persistence split.

### Worker validation and migrations

- [x] Core mutation validation owns the generic envelope and core settings only.
- [x] Narrative, World, State, Inventory, and Media own their mutation payload validation.
- [x] Commands owns validation of its project-settings slice.
- [x] Existing migration history 1–12 is retained unchanged as historical schema fact.
- [x] Added a canonical schema runner that composes historical migrations with future feature-owned migration contributions.
- [x] Duplicate migration IDs are rejected.
- [ ] Add the first real post-12 feature migration through the contribution path when one is needed.
- [ ] Eventually separate immutable historical migration data from its old legacy runner to remove duplicate runner code.

### Single responsive Author system

- [x] Added an initial wide/fine-pointer desktop left Author suite.
- [x] Desktop reuses the same `AuthorHome`, `AuthorInputSurface`, `useWorkSurfaceNavigation`, feature manifests, `AuthorWorkspaceHost`, mutation path, and persistence path as mobile.
- [x] No desktop-specific editor tree or save semantics were introduced.
- [x] Author-mode layout state is stable while text is playing.
- [x] Player-facing workspaces such as Inventory are excluded from Author docking.
- [x] Shared Author workspace runtime callbacks are generic rather than Inventory-named.
- [x] Inventory and Media workspace navigation is feature-manifest driven.
- [ ] Validate all major Author workspaces on the live wide desktop client.
- [ ] Validate mobile/narrow/coarse-pointer behavior on the live client.
- [ ] Validate breakpoint transitions, scrolling, keyboard/focus, and unsaved-change navigation in real browsers.
- [ ] Tune dock width/hierarchy from actual use rather than creating a second UI implementation.

### Clone/fork portability

- [x] Hosted API origin can be overridden with `VITE_API_ORIGIN`.
- [x] Pages base path can be overridden with `VITE_BASE_PATH` and the production workflow derives repository-name base paths.
- [x] Deployment verification can use an installation-specific API origin.
- [x] Added an ID-free `wrangler.template.jsonc` with a draft D1 `DB` binding.
- [x] Added guarded `npm run setup:installation`; it refuses to overwrite an already-configured D1 installation unless explicitly forced.
- [x] Added transitional installation documentation.
- [x] The live production `wrangler.jsonc` retains the existing D1 identity; portability work does not silently replace the live database.
- [ ] Move installation-specific production identity out of reusable defaults without risking the current deployment.
- [ ] Integrate Cloudflare authentication/resource verification into setup.
- [ ] Discover/write the Worker origin automatically after first deploy.
- [ ] Guide or automate GitHub secret/variable setup.
- [ ] Run the complete fresh-fork test through successful Author login/save.

## Client-validation checkpoint

The architecture branch is suitable to merge to `main` for real-client testing when its final validation run is green and the PR remains mergeable. This merge is specifically intended to answer the browser questions that static validation cannot answer.

The live test should focus on:

1. desktop Author docking and simultaneous play/authoring;
2. mobile Author continuity and full-screen workspace behavior;
3. breakpoint/resizing behavior without switching to a second Author implementation;
4. scroll, focus, keyboard, Back/X, and unsaved-change behavior;
5. feature workspaces such as Inventory, Assets, Sound, State/Definitions, Structure, History, Nodes, and Interactions;
6. save/reload persistence and continued play after authored changes;
7. obvious performance regressions, layout jumps, or lost input state.

## Remaining architecture work after client validation

### 1. Use client feedback to finish the responsive Author shell

Browser validation is now a product-development input rather than a reason to keep the code isolated indefinitely. Desktop/mobile findings should be fixed in the shared presentation layer and shared workspace components, not by creating separate implementations.

### 2. Continue reducing `App.tsx`

`App.tsx` remains the main frontend pressure point. Media presentation, State timing, Inventory project-change reconciliation, and Inventory-specific workspace callbacks have been removed from its responsibilities, but session loading, runtime presentation, Author session behavior, and Narrative/Commands application orchestration still meet there.

### 3. Installation bootstrap remains transitional

A new developer has a much clearer supported path now, but setup is not yet “connect Cloudflare and everything is verified automatically.”

### 4. Run an actual feature-deletion build

The acceptance standard remains:

1. remove an optional feature implementation;
2. remove only its explicit registrations/composition entries;
3. do not repair unrelated feature internals;
4. build/typecheck still passes;
5. a project not using that feature still boots and plays.

## Author authenticity test

For any desktop/mobile Author work:

1. open the same project on mobile and desktop;
2. navigate to the same workspace;
3. both must render through the same feature workspace implementation;
4. both must produce the same mutation/persistence semantics;
5. layout differences must not change authored-data meaning.

## Clone/fork acceptance test

A new developer should be able to:

1. clone/fork the repository;
2. connect their own Cloudflare/D1/Worker credentials using supported setup;
3. deploy an initialized engine;
4. enter Author mode;
5. author a distinct complete game without editing application source for ordinary content.

## Change log

### 2026-08-31 — architecture and client-validation pass on `modular-engine-author-suite`

- Started at an estimated 43% architectural completion.
- Created the durable roadmap and boundary rules.
- Added the shared responsive desktop Author dock presentation.
- Added portable API/base-path configuration, Wrangler template, guarded setup helper, and installation guide.
- Moved feature project/play-state, rule payload, mutation, validation, and Worker persistence ownership out of central contracts while preserving source-compatible runtime shapes.
- Reduced `worker/projectStore.ts` to core orchestration.
- Added future feature migration contributions while retaining migration history 1–12 unchanged.
- Added explicit reset/restore dependency ordering and corrected bookmark/node restore ordering.
- Moved Commands project-settings normalization/defaulting and validation beside Commands.
- Added non-deploying PR validation CI and repaired two pre-existing broken tests exposed by that CI.
- Moved Media browser effect presentation and cue extensions behind generic composition boundaries.
- Moved State timed progression behind a generic project-clock composition boundary.
- Removed obsolete `src/game/synth.ts` and `src/game/timedVariables.ts` compatibility facades.
- Generalized shared Author runtime callbacks beyond Inventory.
- Removed Inventory/Media-specific route variants from central Author navigation and added a regression guard against reintroducing them.
- Verified the code head with passing install, typecheck, full tests, and production build.
- Advanced the working estimate to about **77% architecture completion**.
- Designated the next merge as a **live client-validation checkpoint** for desktop and mobile behavior.
