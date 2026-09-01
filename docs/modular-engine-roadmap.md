# Modular Engine + Author Suite Roadmap

This is the durable roadmap for turning Pre-Programmed into a replaceable, cloneable text-game engine while keeping one authentic Author system across mobile and desktop.

## Product goals

1. **Replaceable while prototyping** — features can be removed or rewritten without repairing unrelated systems.
2. **One Author system** — desktop and mobile share state, navigation, editors, mutations, validation, persistence, and save semantics; only presentation changes.
3. **Clone/fork → connect infrastructure → author a complete game** — ordinary game creation should not require editing engine source.

## Architecture rule

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

Explicit composition roots are good. Compatibility layers are transitional and shrink-only.

## Current estimate — about 82%

This is architecture/product completion, not game-content completion. The starting estimate for this modularization pass was about 43%.

The estimate remains intentionally conservative. The exact percentage is less important than the remaining acceptance criteria; do not increase architecture complexity merely to move the number.

## What is now proven

- Feature-owned project/play-state slices are composed into the existing runtime shape.
- Narrative, World, State, Inventory, Media, and Commands own their relevant project/runtime contracts instead of central files defining feature internals.
- Feature mutation handlers, rule contributions, Author workspaces, Worker persistence, and Worker validation compose through explicit registries.
- State timing and project-change reconciliation reach App through generic lifecycle contracts rather than feature-specific App behavior.
- Generic floating notifications are core-owned; Media owns synth/audio/art behavior.
- Optional feature search documents, advanced text cues, Author workspaces, and Author shortcuts contribute through generic boundaries.
- Unmatched-input Author drafting is feature-contributed; App no longer constructs Narrative draft interactions itself.
- Targetless application capabilities are composed at a neutral engine boundary rather than being owned by Commands.
- Worker persistence is feature-owned; `worker/projectStore.ts` is primarily orchestration.
- Runtime schema initialization composes immutable historical migrations with future feature migration contributions through `worker/db/schema.ts`; the obsolete second migration runner has been removed.
- Worker mutation validation is feature-composed, including feature-owned project-settings validation.
- `src/game/model.ts` is now a pure shrink-only compatibility facade rather than an implementation owner.
- Media was physically removed on a temporary probe branch and the engine still passed typecheck, full tests, and build after removing only its explicit registrations/composition entries.
- The same Author implementation has been exercised successfully on real desktop and mobile clients.
- Desktop Author mode can remain open beside the playable game; mobile uses the focused presentation of the same workspaces.
- The live production path has remained healthy through the architecture changes, including a real project-snapshot/D1 verification after Worker deployment.

## Prototype verification policy

Verification must remain replaceable too.

- **Production deployment on `main` is the only automatic workflow.**
- Full verification is an explicit checkpoint through `npm run verify` / the manual Verify Prototype workflow.
- Ordinary branch iteration should not create PRs merely to trigger CI.
- Feature-specific tests may be deleted or rewritten with the feature they protect.
- Core tests protect stable core/data-safety contracts; they must not freeze the current feature roster.
- Physical feature-deletion probes are temporary diagnostics, not permanent CI fixtures.
- Persistence, migrations, authentication, backup/restore, and other authored-data safety boundaries justify stronger long-lived checks.

Do **not** repeat the Inventory deletion probe just because it is possible. Re-run a physical deletion probe when a feature is actually being replaced, or when a boundary change creates a specific reason to doubt replaceability.

## Highest-value remaining work

### 1. Finish clone/fork portability

This is now the largest gap relative to the product goal.

A new developer should be able to fork/clone, connect their own Cloudflare resources, deploy, enter Author mode, and create a distinct game without ordinary source edits.

The supported setup path now:

- detects and replaces upstream production identity inherited by a GitHub fork;
- gives direct upstream clones an explicit `--new-installation` path rather than requiring generic `--force`;
- creates an identity-free local Wrangler configuration;
- chooses a distinct Worker and D1 database name;
- directs the installer to explicitly create D1 with `wrangler d1 create ... --binding DB --update-config`, so the new database name and UUID are persisted before deployment instead of relying on experimental draft-resource provisioning.

Still needed:

- remove the original production D1 identity from reusable tracked configuration without breaking the live installation;
- discover/write the deployed Worker origin more automatically where practical;
- make GitHub Pages secret/variable setup straightforward when desired;
- run one real fresh-fork or fresh-clone installation through D1 creation, deploy, Author login, save, and reload.

The tracked production `wrangler.jsonc` is now the main thing preventing a completely installation-neutral checkout. Do not remove it until the existing production database UUID has a proven deployment-time source.

### 2. Keep shrinking real compatibility behavior

Delete compatibility code when its consumers are gone; do not reorganize harmless one-line facades merely to improve file-count aesthetics.

Completed cleanup includes obsolete Worker bootstrap/per-node mutation routes, the duplicate migration runner, feature-roster verification assumptions, and several central compatibility responsibilities.

Remaining one-line `src/game/*` and `src/components/*` facades are not duplicate implementations. Migrate or delete them when their consumers are naturally touched rather than launching a flag-day import rewrite.

### 3. Reduce App only where ownership becomes clearer

`App.tsx` remains the main frontend meeting point, but refactoring it is not a goal by itself.

Recent work removed direct Narrative draft construction and Commands-owned application-capability resolution from App. Continue moving behavior only when doing so creates a clear stable contract or makes a feature independently replaceable. Avoid generic render registries or hooks that exist only to make App shorter.

### 4. Finish shared Author presentation polish

The single-system approach is proven. Remaining work is mostly presentation quality:

- desktop button sizing/spacing/hierarchy;
- breakpoint transition with unsaved editor state;
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

## Clone/fork acceptance test

A new developer should be able to:

1. fork or clone the repository;
2. connect their own Cloudflare/D1/Worker configuration using the supported setup path;
3. deploy an initialized engine;
4. enter Author mode;
5. author and save a distinct game without editing application source for ordinary content.

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
- `src/game/model.ts` became a pure compatibility facade; UUID/node-number behavior moved to their actual owners.
- Worker project-settings validation stopped directly depending on Commands and now composes through the validation catalog.
- App stopped constructing Narrative draft interactions for unmatched Author input and stopped resolving application capabilities through Commands.
- Application capability contracts/catalogs moved to the neutral engine application boundary.
- Fork/clone setup stopped relying on draft D1 auto-provisioning as the primary path: new installs now explicitly create D1 and persist its binding identity before Worker deployment.

### 2026-08-31

- Modularization began at about 43% estimated architecture completion.
- Feature project/play state, mutations, rules, Worker persistence/validation, responsive Author composition, portable client origin/base path, and future feature migration contributions were established.
