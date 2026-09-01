# Modular Engine + Author Suite Roadmap

This is the durable progress ledger for making Pre-Programmed a replaceable, cloneable text-game engine while preserving one authentic Author system across mobile and desktop.

## Product goals

1. **Replaceable engine systems while prototyping** — a major feature should be removable/rewriteable without patching unrelated systems.
2. **One Author system, responsive presentation** — desktop and mobile use the same navigation, editors, mutations, persistence, validation, and save semantics; only presentation changes.
3. **Clone/fork → connect infrastructure → author a complete game** — ordinary game creation should happen through Author mode rather than source edits.

## Architectural rule

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

A mature feature may own project data, play state, lifecycle, conditions/effects/operations, Author UI, mutations, persistence, validation, presentation contributions, and future migrations. Explicit composition roots are encouraged.

## Current completion estimate — about 82%

This percentage estimates progress toward the architecture/product goals above, not game completeness. The baseline at the start of this pass was about 43%.

| Area | Weight | Current | Weighted |
| --- | ---: | ---: | ---: |
| Feature-oriented source ownership | 12% | 94% | 11.28% |
| Runtime contribution architecture | 12% | 97% | 11.64% |
| Author feature composition | 12% | 93% | 11.16% |
| Responsive single-system Author shell | 12% | 72% | 8.64% |
| Feature-owned project/play-state ownership | 14% | 78% | 10.92% |
| Feature-owned mutations | 10% | 90% | 9.00% |
| Feature persistence/restore/validation | 12% | 90% | 10.80% |
| Feature-owned future migrations | 6% | 50% | 3.00% |
| Clone/fork installation portability | 8% | 45% | 3.60% |
| Boundary/deletion guardrails | 2% | 100% | 2.00% |
| **Total** | **100%** |  | **82.04%** |

The working estimate is therefore **about 82% architecture completion**. The architecture branch passes dependency installation, TypeScript typecheck, the full Vitest suite, and production build. The shared Author system has now also been exercised successfully on real desktop and mobile clients. Remaining Author work is primarily desktop visual polish and further breakpoint/interaction refinement rather than proving that the responsive single-system approach works.

## What changed in this pass

### Feature boundaries and compatibility

- [x] Durable feature-boundary rules exist in `docs/feature-boundaries.md`.
- [x] `src/game/*` is explicitly shrink-only compatibility architecture.
- [x] The old `src/game/model.ts` lost real Inventory/State initialization behavior and now re-exports the canonical engine lifecycle.
- [x] Architecture regression tests cover composition roots, persistence dependency ordering, and optional-feature Author route boundaries.
- [x] Added a branch-safe GitHub Actions validation workflow that never deploys or uses production secrets.
- [x] GitHub CI passes typecheck, the full test suite, and production build on the architecture branch.
- [x] Optional Inventory/Media Author workspaces route through generic feature routes rather than expanding central navigation types.
- [x] Physically removed Media on a throwaway probe and passed typecheck, full tests, and build after removing only its explicit feature/composition registrations.
- [ ] Repeat the deletion probe with a harder stateful feature such as Inventory to test the same boundary rule across more vertical-slice responsibilities.

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
- [x] Proved physical deletion of the optional Media project slice with a complete CI build/test run.

### Rules, presentation, and mutations

- [x] Feature leaf condition/effect payload types moved beside Inventory, State, Narrative, and Media.
- [x] Engine Rules owns recursive/generic condition composition rather than feature leaf semantics.
- [x] Feature mutation payload types moved beside Narrative, World, State, Inventory, and Media.
- [x] Optimistic mutation application dispatches through feature-owned handlers instead of a central feature switch.
- [x] Revision/concurrency remains core-owned.
- [x] Generic floating notifications are core-owned because Narrative and Operations can emit/interpolate them without Media.
- [x] Media owns synth/audio/art effect-event payloads and browser presentation semantics.
- [x] Media-owned text-performance cue extensions are composed through generic cue-event and Author cue-adapter boundaries instead of Narrative hardcoding Media behavior.
- [x] Optional feature search documents enter global Author search through an explicit contribution catalog.
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
- [x] Major Author workspaces were exercised successfully on the live wide desktop client.
- [x] Mobile/narrow/coarse-pointer Author behavior was exercised successfully on a real mobile client.
- [x] A confusing desktop terminal focus bug found during client testing was repaired by preserving input focus across the options dropdown.
- [ ] Do a dedicated breakpoint/resizing pass with unsaved editor state across the transition threshold.
- [ ] Tune desktop button sizing, spacing, and hierarchy based on the live-client visual feedback.

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

## Client-validation result

The responsive architecture is now proven viable on real desktop and mobile clients. The live pass confirmed that the same Author workspaces remain usable in both presentations and that ordinary author/save/play flows work. The primary remaining desktop feedback is visual: button sizing and spacing are inconsistent in places, but no major workspace was unusable.

The client pass also exposed one terminal-focus mismatch: closing the command-options dropdown visually left the custom underscore caret in place while browser focus remained on the toggle. That has been fixed and re-tested successfully.

## Remaining architecture work

### 1. Repeat deletion testing with a harder feature

Media is now a proven deletion case. Inventory is the next useful stress test because it spans project data, play state, reconciliation, conditions/effects, operations, Author UI, persistence, validation, and search. Any failures there will expose a broader class of residual coupling than Media could.

### 2. Continue reducing `App.tsx`

`App.tsx` remains the main frontend pressure point. Media presentation, State timing, Inventory project-change reconciliation, Inventory-specific workspace callbacks, and Media terminal shortcuts have been removed from its responsibilities, but session loading, runtime presentation, Author session behavior, and Narrative/Commands application orchestration still meet there.

### 3. Finish responsive Author visual polish

The shared desktop/mobile implementation works. Next UI work should normalize desktop button sizing/spacing and test breakpoint transitions without introducing a second desktop implementation.

### 4. Installation bootstrap remains transitional

A new developer has a much clearer supported path now, but setup is not yet “connect Cloudflare and everything is verified automatically.”

## Feature-deletion acceptance test

The acceptance standard is now exercised in CI:

1. remove an optional feature implementation;
2. remove only its explicit registrations/composition entries;
3. do not repair unrelated feature internals;
4. typecheck, full tests, and build still pass;
5. shared application code does not retain dead feature-specific entry points.

Media passes this standard. Inventory is the next stress test.

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

### 2026-09-01 — client validation and physical feature-deletion pass

- Exercised the shared Author system successfully on real desktop and mobile clients.
- Fixed and re-tested desktop terminal focus preservation when toggling available command options.
- Ran a real physical Media deletion probe instead of relying on static architecture inspection.
- The first probe exposed hidden Media coupling in notification ownership, global search, Narrative cue authoring, and an omitted Author rule catalog registration.
- Corrected notification to core ownership while keeping synth/audio/art in Media.
- Added feature-contributed global search documents and feature-contributed advanced text-cue Author controls.
- Moved `/assets` and `/sounds` Author aliases out of App and into the Media feature manifest.
- Re-ran physical deletion with Narrative, Operations, global search, NodeEditor, and App left untouched; typecheck, full tests, and build all passed.
- Advanced the working estimate to about **82% architecture completion**.

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
