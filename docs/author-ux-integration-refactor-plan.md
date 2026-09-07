# Author UX + Integration Refactor Plan

Branch: `author-ux-integration-refactor`
Started: 2026-09-06

## Goal

Improve Author mode usability and consistency while paying down the architectural debt identified in the September 2026 systems audit. Preserve the running engine, resource ownership, task semantics, persistence paths, mutation formats, and player behavior.

The guiding rule for this branch is:

> Improve presentation and shared interaction contracts first. Do not casually combine a UX change with a runtime rewrite.

## Protected semantics

Do not change without an isolated, explicitly documented refactor:

- canonical resource ownership and save paths;
- Author task stack semantics and parent/child completion behavior;
- preservation of suspended task draft state;
- project mutation formats and validation ownership;
- semantic reference contracts;
- rule/effect contracts;
- player runtime behavior;
- save/load data compatibility;
- mobile/desktop capability parity.

Presentation may change freely when the same underlying task, draft, mutation, and save semantics are preserved.

## Audit baseline

Previous audit summary:

- Overall cleanliness: ~8.2/10
- Overall integration: ~9.0/10
- Strongest shared architecture: engine catalogs/contracts, Author task/resource system, State, Inventory, Operations, World.
- Main architectural debt: `src/App.tsx` remains a large feature-aware runtime traffic controller.
- Main Author debt at branch start: Narrative, Media, Commands, and Project still included legacy unrestricted Author workspace rendering.
- Session ownership is split between feature code, `src/data/localPlaySession.ts`, and App orchestration.

### System baseline

| System | Cleanliness | Integration |
| --- | ---: | ---: |
| State | 9.1 | 9.7 |
| Inventory | 8.8 | 9.6 |
| Operations | 9.2 | 9.4 |
| World | 9.0 | 9.2 |
| Radix | 8.9 | 8.4 |
| Media | 7.6 | 9.0 |
| Commands | 7.2 | 9.2 |
| Narrative | 7.2 | 9.5 |
| Session | 7.4 | 7.8 |
| App/runtime orchestration | 5.8 | 6.7 |

## UX principles for this branch

1. Keep recursive nesting as the underlying model, but do not force the author to experience every layer as a click.
2. Seen means editable: references should expose direct routes to their canonical editor.
3. Gestures are accelerators, never the only route to an action.
4. Shared Author UI owns common visual/interaction language; features own authored meaning and persistence.
5. Replace explainer text with clear controls where the UI can carry the meaning itself.
6. Desktop and mobile expose the same actions; responsive presentation and input gestures may differ.
7. Avoid adding feature-specific knowledge to `App.tsx` unless it is an explicit composition-root installation.
8. No new feature should enter `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS`.

## Work phases

### Phase 1 — shared Author interaction improvements

- [x] Selected canonical references expose direct `[EDIT]` without opening the chooser first.
- [x] Empty creatable references expose `[+ CREATE]`.
- [x] Shared reference UI no longer explains nested-task mechanics in prose.
- [x] Clean task-trail ancestors are directly navigable; dirty descendants block the shortcut.
- [x] Dirty task trail entries display a visible `*`, including on mobile where hover help does not exist.
- [x] Structured workspaces no longer add a second footer `[BACK]`; shared Author host owns Back/X.
- [x] Reference-owned child completion briefly marks the returned-to reference.
- [x] Generic nested task opening remembers the triggering focused element and restores focus when that child closes.
- [x] Quick Find and Author Tools copy substantially reduced to raw controls/status instead of mechanics explanations.
- [ ] Re-evaluate the remaining `SAVE RETURNS TO …` shell text now that return behavior is visible and focus restoration exists.
- [ ] Manual mobile/desktop validation of focus return, trail jumping, long-press, and keyboard-open layout.

### Phase 2 — shared semantic Author UI grammar

- [x] Add semantic `resource` node.
- [x] Route semantic resources through canonical `ReferenceField` behavior (choose/edit/create/preview/long-press/return).
- [x] Add semantic `action-row` node for ordinary contextual actions inside task bodies.
- [x] Add shared validation/rendering/responsive treatment for both primitives.
- [x] Update `docs/author-ui-grammar.md` so code and architecture contract agree.
- [x] Migrate World character Portrait to `resource`.
- [x] Migrate Inventory item tile art to `resource`.
- [x] Migrate Inventory Configure Equipment launcher to `action-row`.
- [x] Migrate World Character/Location create actions to `action-row`.
- [ ] Migrate remaining simple resource-picker escape hatches when their files are touched. Known examples: Inventory Body Type background, State player-presentation group.

`custom` should remain for genuinely specialized controls: rule trees, operation editors, graph browsers, sequencers, layouts, drawing surfaces, and result browsers—not ordinary fields/resources/buttons.

### Phase 3 — incremental legacy Author migration

Structured workspace matching runs before legacy `renderWorkspace`, allowing one route at a time to migrate without duplicating or rewriting canonical editors.

#### Project

- [x] Run Navigation / History dispatch moved to shared Author registry.
- [x] `project` removed from `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS`.
- [x] Obsolete unused `WorkspacePanel.onClose` removed.

#### Narrative

- [x] Node editor was already structured.
- [x] Story Structure route moved to structured Author workspace.
- [x] Structure graph browser remains a feature-owned specialized control embedded inside the shared task shell.
- [x] Duplicate Structure task frame/header removed; shared Author shell owns task chrome.
- [ ] Remaining unrestricted renderer: **Interaction editor only**.

#### Media

- [x] Synth Sounds list moved to structured Author workspace; old legacy Synth list branch removed.
- [x] Media Assets browser moved to structured Author workspace as a specialized control.
- [x] Duplicate Asset Explorer Author frame/header removed.
- [x] Obsolete Asset Explorer close prop removed.
- [x] Migrated legacy `assets` and `synth` branches physically removed rather than left unreachable.
- [ ] Remaining unrestricted renderer: **actual Media asset editor, vector editor, and synth editor only**.

#### Commands

- [x] Player Interactions route moved to structured Author workspace.
- [x] Player Commands list (`grammar` / `capabilities`) moved to structured Author workspace.
- [x] Target Names + Aliases list moved to structured Author workspace.
- [x] Target Behavior list moved to structured Author workspace.
- [ ] Remaining unrestricted renderer: **Player Command editor and per-target Reference Source editor**.
- [ ] Delete now-unreachable legacy list components from `CommandSettings.tsx` once the two remaining editors are cleanly separated from them.

#### Legacy exception list

`LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` still contains `narrative`, `media`, and `commands` because each still owns at least one real unrestricted editor. Do not remove an id until its last unrestricted path is genuinely gone.

### Phase 4 — isolated runtime integration refactors

Do only after Author/shared-layer work is stable and continuously green.

- [ ] Reduce Radix-specific startup/presentation knowledge in `App.tsx` through a presentation/runtime contribution.
- [ ] Move Narrative player presentation/execution semantics behind a Narrative-owned runtime contribution rather than calculating them directly in App.
- [ ] Consolidate complete play-session lifecycle ownership under Session.
- [ ] Re-audit direct feature imports/branches in App after each extraction.

## Temporary branch verification

The working environment cannot clone GitHub directly because outbound DNS is blocked. To avoid relying on static review, this branch temporarily contains:

`.github/workflows/verify-author-ux-refactor.yml`

It runs on pushes to this branch only:

1. checkout;
2. Node 22;
3. `npm ci --no-audit --no-fund`;
4. `npm run verify`.

**Delete this temporary workflow before merging.** It is branch scaffolding for this refactor, not permanent engine infrastructure.

The workflow uses a concurrency group with `cancel-in-progress: true`; cancelled intermediate runs normally mean a newer commit superseded them, not that verification failed.

### Successful verification checkpoints

Full `npm run verify` has passed after:

- initial shared Author/resource/task changes;
- Commands navigation/list structured migrations;
- Media Synth list migration;
- Narrative Story Structure migration;
- generic nested return-focus behavior;
- Media legacy cleanup;
- Media Assets structured browser migration after correcting its module extension to `.tsx`.

There were short-lived red intermediate commits while multi-file migrations were being completed (for example removing a prop before removing its caller, and introducing JSX before renaming a `.ts` module to `.tsx`). The final corrected heads were verified green; do not treat those superseded intermediate runs as current branch failures.

## Manual acceptance route before merge

- enter Author mode from live play;
- edit current Narrative node and an interaction;
- follow/edit referenced State, World, Inventory, and Media resources from context;
- mobile: long-press a selected reference and confirm it opens the same canonical editor as `[EDIT]`;
- create from an empty reference using `[+ CREATE]`, save child, and confirm parent draft resumes with new value;
- confirm focus returns to the triggering control after closing/saving nested tasks;
- create a 3+ task clean stack and tap an ancestor directly;
- dirty a descendant and confirm ancestor shortcut is blocked while `*` visibly marks unsaved state;
- confirm master X returns to player and Back remains within Author tasks;
- open Player Interactions, Player Commands, Target Names + Aliases, and Target Behavior after their structured migration;
- open Story Structure and verify search/path/legend/node/interaction editing still work;
- open Media Assets and Synth Sounds and verify their browser/list behavior still opens the same canonical editors;
- test narrow/mobile presentation with keyboard open;
- confirm ordinary player behavior remains unchanged.

## Current branch relationship

Latest comparison on 2026-09-06:

- base / merge-base: `02d5ac8cb77556094bf6c83c8c9721d0c8940c1c`
- branch: `author-ux-integration-refactor`
- status: ahead of `main`
- ahead: 54 commits at the last comparison checkpoint
- behind: **0 commits**
- no `App.tsx`, gameplay runtime, project mutation, durable persistence, or Worker files changed yet.

## Change log

### 2026-09-06 — initial shared layer

- Created branch and this living plan before implementation.
- Added direct reference Edit/Create behavior and shared touch/pen long-press accelerator.
- Added returned-reference marker.
- Added actionable clean task ancestors and visible dirty markers.
- Removed duplicate structured footer Back.
- Added semantic `resource` and `action-row` grammar primitives and documentation.
- Migrated initial World/Inventory controls to the shared primitives.
- Simplified Quick Find / Author Tools mechanics copy.
- Moved Project Run Navigation / History to shared routing and removed Project from the legacy exception list.

### 2026-09-06 — executable verification + legacy reduction

- Added temporary branch-only `npm run verify` workflow because local checkout is unavailable in this environment.
- Confirmed repeated green full verification checkpoints.
- Added generic focus restoration when a nested Author task returns to its still-mounted parent.
- Commands: migrated Player Interactions, Player Commands list, Target Names + Aliases list, and Target Behavior list to structured workspaces.
- Narrative: migrated Story Structure to structured task shell while retaining the graph browser as a specialized control; unrestricted renderer now handles only Interaction editing.
- Media: migrated Synth Sounds list and Media Assets browser to structured task shells; removed their legacy branches and obsolete close wiring; unrestricted renderer now handles only canonical Media editors.
- Media Assets instructional copy shortened while preserving the necessary D1-vs-repository file workflow distinction.

## Resume here

At the start of every session:

1. read this document;
2. compare branch to current `main` and record any incoming divergence before editing;
3. inspect the latest branch verification run; keep the head green before moving into a higher-risk slice;
4. finish small cleanup created by migrations before starting a new one (dead components/selectors/imports);
5. next cleanup target: delete unreachable Commands list components from `CommandSettings.tsx` without touching the remaining Command/Reference Source editor persistence paths;
6. next shared UX target: decide whether `SAVE RETURNS TO …` is now redundant, and polish embedded Structure/Media browser layout on narrow screens;
7. only after the shared/Author migration is stable, begin Phase 4 runtime extraction in isolated commits;
8. before merge: run final full verification, perform the manual Author acceptance route, and **delete `.github/workflows/verify-author-ux-refactor.yml`**;
9. update this document before ending any session where meaningful work occurred.
