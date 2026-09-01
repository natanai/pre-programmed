# Modular Engine + Author Suite Roadmap

This is the durable progress ledger for making Pre-Programmed a replaceable, cloneable text-game engine while preserving one authentic Author system across mobile and desktop.

## Product goals

1. **Replaceable engine systems while prototyping** — a major feature should be removable/rewriteable without patching unrelated systems.
2. **One Author system, responsive presentation** — desktop and mobile use the same navigation, editors, mutations, persistence, validation, and save semantics; only presentation changes.
3. **Clone/fork → connect infrastructure → author a complete game** — ordinary game creation should happen through Author mode rather than source edits.

## Architectural rule

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

A mature feature may own project data, play state, lifecycle, conditions/effects/operations, Author UI, mutations, persistence, validation, and future migrations. Explicit composition roots are encouraged.

## Current completion estimate — about 72%

This percentage estimates progress toward the architecture/product goals above, not game completeness. The baseline at the start of this pass was about 43%.

| Area | Weight | Current | Weighted |
| --- | ---: | ---: | ---: |
| Feature-oriented source ownership | 12% | 90% | 10.8% |
| Runtime contribution architecture | 12% | 90% | 10.8% |
| Author feature composition | 12% | 75% | 9.0% |
| Responsive single-system Author shell | 12% | 40% | 4.8% |
| Feature-owned project/play-state ownership | 14% | 70% | 9.8% |
| Feature-owned mutations | 10% | 90% | 9.0% |
| Feature persistence/restore/validation | 12% | 90% | 10.8% |
| Feature-owned future migrations | 6% | 50% | 3.0% |
| Clone/fork installation portability | 8% | 45% | 3.6% |
| Boundary/deletion guardrails | 2% | 70% | 1.4% |
| **Total** | **100%** |  | **≈72.9%** |

The working estimate is therefore **about 72%**. Code-side merge readiness is now much higher than the previous checkpoint: GitHub Actions has successfully run dependency installation, `npm run typecheck`, the full Vitest suite, and `npm run build` on this branch. The desktop Author dock still needs real-browser validation before this PR should be treated as merge-ready.

## What changed in this pass

### Feature boundaries and compatibility

- [x] Durable feature-boundary rules exist in `docs/feature-boundaries.md`.
- [x] `src/game/*` is explicitly shrink-only compatibility architecture.
- [x] The old `src/game/model.ts` lost real Inventory/State initialization behavior and now re-exports the canonical engine lifecycle.
- [x] Architecture regression tests were added for composition roots and persistence dependency ordering.
- [x] Added a branch-safe GitHub Actions validation workflow that never deploys or uses production secrets.
- [x] GitHub CI now passes typecheck, the full test suite, and production build on the architecture branch.
- [ ] Add true feature-deletion checks.

### Project/play-state ownership

- [x] Narrative owns its project/play-state field slices.
- [x] Inventory owns its project/play-state field slices.
- [x] State owns its project/play-state field slices.
- [x] World owns its project-data slice.
- [x] Media owns its project-data slice.
- [x] Commands owns its play-state slice.
- [x] `ProjectSnapshot` and `PlayState` are composed from feature-owned slices while retaining the existing flat runtime shape for compatibility.
- [x] Narrative, State, Inventory, and Commands own their play-state initialization/reconciliation contributions.
- [x] Commands now owns its project-settings defaults/normalization and Worker validation while the persisted `settings.commands` shape remains unchanged.
- [ ] Prove deletion of an optional feature with a build/test run.

### Rules and mutations

- [x] Feature leaf condition/effect payload types moved beside Inventory, State, Narrative, and Media.
- [x] Engine Rules now owns recursive/generic condition composition rather than feature leaf semantics.
- [x] Feature mutation payload types moved beside Narrative, World, State, Inventory, and Media.
- [x] Optimistic mutation application dispatches through feature-owned handlers instead of a central feature switch.
- [x] Revision/concurrency remains core-owned.

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

- [x] Core mutation validation now owns the generic envelope and core settings only.
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
- [ ] Manually validate all major Author workspaces on a wide desktop browser.
- [ ] Validate narrow desktop/tablet breakpoint behavior.
- [ ] Tune dock width/hierarchy after actual use rather than creating a second UI implementation.

### Clone/fork portability

- [x] Hosted API origin can be overridden with `VITE_API_ORIGIN`.
- [x] Pages base path can be overridden with `VITE_BASE_PATH` and the production workflow derives repository-name base paths.
- [x] Deployment verification can use an installation-specific API origin.
- [x] Added an ID-free `wrangler.template.jsonc` with a draft D1 `DB` binding.
- [x] Added guarded `npm run setup:installation`; it refuses to overwrite an already-configured D1 installation unless explicitly forced.
- [x] Added transitional installation documentation.
- [ ] Move the live installation-specific D1 identity out of reusable defaults without risking the current production database.
- [ ] Integrate Cloudflare authentication/resource verification into setup.
- [ ] Discover/write the Worker origin automatically after first deploy.
- [ ] Guide or automate GitHub secret/variable setup.
- [ ] Run the complete fresh-fork test through successful Author login/save.

## Remaining major architectural blockers

### 1. Browser validation of the responsive Author shell

The architecture branch now passes GitHub typecheck, tests, and production build. The major unverified part is presentation behavior: the dock needs real use on a wide desktop, narrow desktop/tablet, and mobile to confirm sizing, scrolling, hierarchy, and interaction with the live player terminal.

### 2. `App.tsx` still knows too much

`App.tsx` remains the main frontend pressure point: project/session loading, feature runtime orchestration, Author session behavior, presentation, and several feature-specific integrations still meet there. The next frontend architecture pass should reduce it toward application/session composition rather than feature implementation.

### 3. Installation bootstrap is transitional

A new developer has a much clearer supported path now, but setup is not yet “connect Cloudflare and everything is verified automatically.”

### 4. Actual deletion tests have not run

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

### 2026-08-31 — architecture pass on `modular-engine-author-suite`

- Started at an estimated 43% architectural completion.
- Created the durable roadmap and boundary rules.
- Added the shared responsive desktop Author dock presentation.
- Added portable API/base-path configuration, Wrangler template, guarded setup helper, and installation guide.
- Moved feature project/play-state, rule payload, and mutation ownership out of central contracts while preserving source-compatible runtime shapes.
- Moved optimistic mutation behavior behind feature handlers.
- Moved Narrative/World/State/Inventory/Media D1 persistence behind one Worker feature contribution contract.
- Reduced `worker/projectStore.ts` to core orchestration.
- Moved feature mutation validation behind feature validators.
- Added future feature migration contributions while retaining migration history 1–12 unchanged.
- Added explicit reset/restore dependency ordering and corrected bookmark/node restore ordering.
- Added modular architecture regression tests.
- Moved Commands project-settings normalization/defaulting and validation beside Commands.
- Added non-deploying PR validation CI.
- CI exposed two pre-existing broken tests on `main`; repaired the stale text-expression helper ownership/import and corrected a false-positive command-capability assertion.
- Verified the branch with passing typecheck, full tests, and production build.
- Current estimate: about **72% architecture completion**, pending browser validation and deletion/fresh-fork acceptance tests.
