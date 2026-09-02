# Modular Engine + Author Suite Roadmap

This is the durable roadmap for turning Pre-Programmed into a replaceable, portable text-game engine while keeping one authentic Author system across mobile and desktop.

## Product goals

1. **Replaceable while prototyping** — features can be removed or rewritten without repairing unrelated systems.
2. **One Author system** — desktop and mobile share state, navigation, editors, mutations, validation, persistence, and save semantics; only presentation changes.
3. **Hosted portability** — fork/clone → connect infrastructure → author a complete game without ordinary engine-source edits.
4. **Local portability** — the engine must also be able to run directly on a user's own machine without requiring Cloudflare as the permanent storage/runtime platform.

## Architecture rule

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

Explicit composition roots are good. Compatibility layers are transitional and shrink-only.

Platform-specific services follow the same rule: Cloudflare is one platform adapter, not the definition of project persistence or Author behavior.

## Current estimate — about 90%

This is architecture/product completion, not game-content completion. The starting estimate for this modularization pass was about 43%.

The estimate remains intentionally conservative. The exact percentage is less important than the remaining acceptance criteria; do not increase architecture complexity merely to move the number. See `docs/engine-100-percent-acceptance.md` for the explicit definition of the remaining ~10%.

## What is now proven

- Feature-owned project/play-state slices are composed into the existing runtime shape.
- Narrative, World, State, Inventory, Media, and Commands own their relevant project/runtime contracts instead of central files defining feature internals.
- Feature mutation handlers, rule contributions, Author workspaces, Worker persistence, and Worker validation compose through explicit registries.
- State timing and project-change reconciliation reach App through generic lifecycle contracts rather than feature-specific App behavior.
- Generic floating notifications are core-owned; Media owns synth/audio/art behavior.
- Optional feature search documents, advanced text cues, Author workspaces, and Author shortcuts contribute through generic boundaries.
- Persistent Author search, human task trails, nested-resource return context, shared outcome composition, and command-target authoring now compose without a screen-owned target roster.
- Unmatched-input Author drafting is feature-contributed; App no longer constructs Narrative draft interactions itself.
- Narrative's contextual Author input surface is feature-contributed rather than directly imported by App.
- Author tool context is feature-neutral; Narrative derives its own current-node/fallback/interaction-notation state.
- State definitions and Narrative Structure navigation use generic feature routes rather than expanding the central Author route union.
- Targetless application capabilities are composed at a neutral engine boundary rather than being owned by Commands.
- Worker persistence is feature-owned; `worker/projectStore.ts` is primarily orchestration.
- Runtime schema initialization composes immutable historical migrations with future feature migration contributions through `worker/db/schema.ts`; the obsolete second migration runner has been removed.
- Worker mutation validation is feature-composed, including feature-owned project-settings validation.
- Prototype aggregate model imports have been removed; callers import the engine or feature owner directly.
- Media was physically removed on a temporary probe branch and the engine still passed typecheck, full tests, and build after removing only its explicit registrations/composition entries.
- The same Author implementation has been exercised successfully on real desktop and mobile clients.
- Desktop Author mode can remain open beside the playable game; mobile uses the focused presentation of the same workspaces.
- Desktop/mobile breakpoint changes use CSS over one stable Author component/navigation tree; there is no breakpoint-specific editor state implementation.
- Production deployment has successfully generated its Wrangler configuration from the reusable template plus the existing Worker's deployed D1 binding, then deployed and passed a real live project-snapshot check.
- Installation-specific `wrangler.jsonc` is local/ignored state rather than reusable engine source.
- Mutable project storage is expressed through the platform-neutral `ProjectPersistence` contract; hosted Cloudflare storage is an implementation of that contract rather than the contract itself.
- Author workspace/history/undo services now compose through a platform-neutral `AuthorPlatform`; Cloudflare is the current hosted implementation.
- A true local-machine runtime now exists: `npm run local` starts the same Worker, canonical D1 schema/migrations, Author API, and Vite client using local-only D1 state.
- `npm run verify:local` has passed a full fresh local project → Author login → persisted mutation → complete shutdown → restart → same revision acceptance path twice on Linux CI.
- Local runtime process-tree shutdown was corrected and re-proven without leaving Wrangler/workerd descendants for the runner to terminate.
- Local D1 does not use `remote: true`; its data is isolated from hosted/production D1.

## Prototype verification policy

Verification must remain replaceable too.

- **Production deployment on `main` is the only automatic workflow.**
- Full verification is an explicit checkpoint through `npm run verify` / the manual Verify Prototype workflow.
- Local-runtime acceptance is an explicit checkpoint through `npm run verify:local`; it is not an automatic tax on every production deploy.
- Ordinary branch iteration should not create PRs merely to trigger CI.
- Feature-specific tests may be deleted or rewritten with the feature they protect.
- Core tests protect stable core/data-safety contracts; they must not freeze the current feature roster.
- Physical feature-deletion probes are temporary diagnostics, not permanent CI fixtures.
- Persistence, migrations, authentication, backup/restore, and other authored-data safety boundaries justify stronger long-lived checks.

Do **not** repeat the Inventory deletion probe just because it is possible. Re-run a physical deletion probe when a feature is actually being replaced, or when a boundary change creates a specific reason to doubt replaceability.

## Highest-value remaining work

### 1. Prove a literal clean hosted installation

The repo-side hosted portability architecture is now installation-neutral. The remaining acceptance gap is empirical rather than architectural.

Run one real fresh fork or clone through the complete path:

1. setup;
2. its own D1 creation;
3. first Worker deploy;
4. client/API configuration;
5. GitHub production deployment if desired;
6. Author login;
7. save an edit;
8. reload and confirm persistence.

That run should also confirm that the installation guidance around GitHub variables/secrets is sufficiently clear without source edits. It must use a separate D1 and must never point at the existing production database.

Do not add more hosted-portability abstraction merely because the clean-install acceptance run has not happened yet. Fix only concrete friction exposed by that run.

### 2. Finish remaining core / platform ownership

Delete compatibility behavior when its consumers are gone; do not reorganize harmless one-line facades merely to improve file-count aesthetics.

The remaining Narrative-specific central Author route shapes are `node` and `interaction`. They carry editor payloads and should not be converted mechanically. Prefer stable feature-owned identifiers/data if they migrate cleanly; do not introduce object registries or serialization workarounds merely to delete two union variants.

`App.tsx` remains the main frontend meeting point, but refactoring it is not a goal by itself. Project persistence and Author workspace/history/undo now have platform composition roots; remaining direct hosted session/login/backup/save selection should move only where the resulting boundary is real and useful to both hosted and local operation.

Prototype-era `src/game/*` and Author-field component facades are gone. New work imports the engine or feature owner directly; do not restore migration shims for deleted prototypes.

### 3. Real-machine local acceptance

The local architecture is no longer hypothetical. `npm run local` and `npm run verify:local` use the actual Worker/D1 implementation locally, not a second save engine.

Remaining local work is empirical:

- run the documented path on ordinary Windows and macOS machines as well as Linux;
- confirm `npm install` → `npm run local` works without a Cloudflare account or credentials;
- author manually through the browser UI, stop the local runtime, restart, and confirm the visible edit persists;
- fix only concrete cross-platform/process/UX friction found by those runs.

The browser IndexedDB cache remains a responsiveness/offline queue and is not promoted into a second canonical local store.

### 4. Finish shared Author presentation polish

The single-system approach is proven. Remaining work is mostly presentation quality and real-client confirmation:

- desktop button sizing/spacing/hierarchy based on actual screenshots/use rather than speculative restyling;
- explicitly resize across the desktop/mobile breakpoint with an unsaved editor open and confirm the already-shared state remains intact;
- continued keyboard/focus/scroll refinement from real-client use.

Do not create separate desktop/mobile editor implementations.

### 5. Let tests migrate with features

Existing centralized tests are transitional. Do not launch a repo-wide test relocation project solely for tidiness.

When a feature is substantially rewritten, move/simplify/delete its tests at the same time so verification ownership follows runtime ownership.

## Feature deletion acceptance test

When a physical deletion probe is warranted:

1. delete the feature implementation;
2. remove only its explicit registrations/composition entries;
3. do not repair unrelated feature internals;
4. a project not using the feature still typechecks/builds/plays;
5. shared UI does not retain dead feature-specific entry points.

Media has passed this test. That is sufficient evidence for the architecture direction at the current prototype stage.

## Author authenticity test

For desktop/mobile Author work:

1. open the same project on both presentations;
2. navigate to the same workspace;
3. both render through the same workspace implementation;
4. both produce the same mutation/persistence semantics;
5. layout differences do not change authored-data meaning.

## Hosted clone/fork acceptance test

A new developer should be able to:

1. fork or clone the repository;
2. connect their own Cloudflare/D1/Worker configuration using the supported setup path;
3. deploy an initialized engine;
4. enter Author mode;
5. author and save a distinct game without editing application source for ordinary content.

## Local-machine acceptance test

A new developer/user should be able to:

1. clone or download the repository;
2. install dependencies;
3. run `npm run local` without configuring a Cloudflare account;
4. enter Author mode with the local trust model;
5. save a project edit;
6. fully stop the runtime;
7. restart it and see the same edit;
8. author ordinary game content without editing engine source.

`npm run verify:local` already proves steps 3–7 programmatically on Linux CI. Human-machine acceptance remains for cross-platform ergonomics.

## Recent checkpoints

### 2026-09-01

- Real desktop/mobile Author validation completed; shared Author architecture proved viable.
- Desktop terminal dropdown focus bug found in client testing and fixed.
- Media physical deletion exposed and then removed hidden coupling in notification ownership, global search, Narrative cue authoring, and Author routing.
- Media deletion then passed typecheck/tests/build with unrelated shared systems untouched.
- Automatic PR validation was removed; full verification became an explicit checkpoint and feature-roster architecture tests/default assertions were removed.
- Verification ownership rules were added to `docs/feature-boundaries.md`.
- Worker API compatibility cleanup removed obsolete bootstrap/per-node routes and standardized on the canonical schema owner.
- The historical migrations file became data/helper-only; the obsolete duplicate runtime migration owner was deleted and the live project-snapshot check remained green.
- UUID/node-number behavior and all former aggregate model imports now resolve directly to their actual owners.
- Worker project-settings validation stopped directly depending on Commands and now composes through the validation catalog.
- App stopped constructing Narrative draft interactions for unmatched Author input and stopped resolving application capabilities through Commands.
- Narrative's current-input Author surface moved behind the feature manifest; obsolete duplicate unhandled-input authoring UI was deleted.
- Author tool context became feature-neutral, with Narrative deriving its own current-node/fallback state and owning its interaction notation helper.
- State definitions and Narrative Structure navigation/terminal aliases moved behind generic feature routes, shrinking the central Author route union and hardcoded App shortcuts.
- Application capability contracts/catalogs moved to the neutral engine application boundary.
- Fork/clone setup stopped relying on draft D1 auto-provisioning as the primary path: new installs now explicitly create D1 and persist its binding identity before Worker deployment.
- Cloudflare D1 control-plane lookup was deliberately tested and rejected because the current deployment token lacks that permission; the probe failed before deployment and was removed.
- Worker version-detail metadata was proven to expose the deployed `DB` binding with the existing Worker deployment permission.
- Production then deployed successfully from a generated Wrangler config whose Worker/D1 identity matched the former tracked production config, followed by a successful live project-snapshot check.
- Installation-specific `wrangler.jsonc` was removed from reusable tracked source and made local/ignored state.
- Project persistence and Author workspace/history/undo received explicit platform composition boundaries instead of treating Cloudflare as the engine contract.
- `wrangler.local.jsonc`, `npm run local`, and local-only persisted D1 state established the first supported no-cloud local distribution using the same Worker and schema as hosted mode.
- `npm run verify:local` proved starter initialization, Author login, a real mutation, full shutdown, restart, and persisted revision. The proof was repeated after process-tree shutdown was fixed; the second run left no Worker/Vite descendants requiring runner cleanup.

### 2026-08-31

- Modularization began at about 43% estimated architecture completion.
- Feature project/play state, mutations, rules, Worker persistence/validation, responsive Author composition, portable client origin/base path, and future feature migration contributions were established.
