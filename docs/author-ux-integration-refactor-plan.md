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
- [x] Removed redundant `SAVE RETURNS TO …` shell copy from normal navigation and keyboard-open Stack; the task trail and actual focus-restoring return behavior now carry this model.
- [ ] Manual mobile/desktop validation of focus return, trail jumping, long-press, and keyboard-open layout.

### Phase 2 — shared semantic Author UI grammar

- [x] Add semantic `resource` node.
- [x] Route semantic resources through canonical `ReferenceField` behavior (choose/edit/create/preview/long-press/return).
- [x] Add semantic `action-row` node for ordinary contextual actions inside task bodies.
- [x] Add shared validation/rendering/responsive treatment for both primitives.
- [x] Update `docs/author-ui-grammar.md` so code and architecture contract agree.
- [x] Migrate World character Portrait to `resource`.
- [x] Migrate Inventory item tile art to `resource`.
- [x] Migrate Inventory Body Type background image to `resource`, including shared Media preview/Edit/Create/return behavior.
- [x] Migrate State Player Presentation group selector to `resource`.
- [x] Migrate Inventory Configure Equipment launcher to `action-row`.
- [x] Migrate World Character/Location create actions to `action-row`.
- [ ] Audit current branch for any remaining ordinary `custom` resource-picker escape hatches before removing that legacy role from the grammar.

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
- [x] Deleted the four now-unreachable legacy route components, their old renderer branches, the helper used only by them, and migrated list-route CSS instead of leaving prototype UI dormant.
- [ ] Remaining unrestricted renderer: **Player Command editor and per-target Reference Source editor only**.

#### Legacy exception list

`LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` still contains `narrative`, `media`, and `commands` because each still owns at least one real unrestricted editor. Do not remove an id until its last unrestricted path is genuinely gone.

### Phase 4 — isolated runtime integration refactors

Do only in behavior-preserving, independently verified slices.

- [x] Reduce Radix-specific startup/presentation knowledge in `App.tsx` through a feature-owned runtime presentation controller.
  - `useRadixRuntimePresentation` now owns startup sequence selection, active run state, sequence reconciliation, synth resolution, completion, effect-triggered runs, and Radix surface rendering.
  - App retains only generic launch-blocking coordination and calls the controller's `active`, `startup`, `surface`, `showSequence`, `beginStartup`, and `suppressStartup` capabilities.
  - Direct `RadixSequenceSurface`, sequence lookup, synth lookup, active Radix structure, and Radix completion/reconciliation branches were removed from App.
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
- Media Assets structured browser migration after correcting its module extension to `.tsx`;
- embedded Structure/shared-shell cleanup;
- creation of the Radix runtime presentation controller;
- the deterministic Radix App extraction itself;
- an independent ordinary branch run after the Radix App extraction;
- physical deletion of migrated Commands route components/styles;
- Inventory Body Type background migration to semantic `resource`;
- State Player Presentation group migration to semantic `resource`;
- removal of redundant nested-return mechanics copy from the shared Author shell.

One-shot workflows are used only for mechanically editing large files when connector reads are chunked. They assert exact source shape, run full `npm run verify`, commit only on success, and remove themselves. A failed assertion therefore leaves the intended source change uncommitted; the State group migration demonstrated this safeguard when its first source-shape assertion failed before install/verify, then was corrected against the exact source and passed fully.

The Radix App extraction used the same pattern. The resulting App commit is `870c7eeb70d58df5f99777485e33667b5f024f03` (`refactor: delegate radix runtime presentation`). GitHub does not recursively trigger push workflows from a `GITHUB_TOKEN` push, so human-authored plan/checkpoint commits are used to trigger independent normal branch verification after groups of bot-committed verified changes.

There were short-lived red intermediate/staging commits while multi-file migrations were being completed. Final corrected heads were verified green; do not treat superseded intermediate runs as current branch failures.

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
- verify nested Author navigation no longer needs or displays `SAVE RETURNS TO …` helper copy;
- open Player Interactions, Player Commands, Target Names + Aliases, and Target Behavior after their structured migration;
- edit a Player Command and a per-target Reference Source through their unchanged canonical legacy editors;
- edit a Body Type background image and confirm the shared Media chooser/preview/Edit/Create behavior;
- edit a State value's Player Presentation group and confirm the shared State Group reference behavior;
- open Story Structure and verify search/path/legend/node/interaction editing still work;
- open Media Assets and Synth Sounds and verify their browser/list behavior still opens the same canonical editors;
- test Radix startup presentation, effect-triggered Radix presentation, Author Edit Sequence/Edit Source affordances, and resume to node text after startup;
- test narrow/mobile presentation with keyboard open;
- confirm ordinary player behavior remains unchanged.

## Current branch relationship

Latest comparison on 2026-09-06:

- base / merge-base: `02d5ac8cb77556094bf6c83c8c9721d0c8940c1c`
- branch: `author-ux-integration-refactor`
- status: ahead of `main`
- ahead: **71 commits** before this documentation update
- behind: **0 commits**
- current pre-documentation head: `19314ac5827b7868841561aed28e1b7e991cedad` (`ux: remove redundant nested return copy`).
- `App.tsx` has its first behavior-preserving feature-runtime extraction: Radix presentation/startup ownership moved behind `useRadixRuntimePresentation`.
- No project mutation formats, durable persistence formats, Worker persistence, or gameplay save schema changed in the Radix extraction or the subsequent Author cleanups.

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

### 2026-09-06 — first runtime ownership extraction

- Added feature-owned `useRadixRuntimePresentation`.
- Moved Radix startup selection, active presentation state, deleted-sequence reconciliation, synth resolution, completion, effect-triggered presentation, and UI rendering out of App.
- Replaced App's direct Radix implementation knowledge with a narrow controller capability surface.
- Deterministic one-shot workflow applied the App patch and ran full `npm run verify` before committing; its temporary tooling removed itself afterward.
- Post-commit source audit confirmed no direct `RadixSequenceSurface`, active Radix data structure, sequence lookup, or synth lookup remains in App.
- Independent normal branch `npm run verify` subsequently passed on the Radix-integrated head.

### 2026-09-06 — post-Radix Author cleanup

- Physically deleted migrated Commands route components and dead CSS while preserving Player Command / Reference Source editor ownership and persistence unchanged.
- Migrated Inventory Body Type background image from a custom `ReferenceField` escape hatch to the shared semantic `resource` node.
- Migrated State Player Presentation group selection from a custom `ReferenceField` escape hatch to the same semantic `resource` node.
- Removed `SAVE RETURNS TO …` from shared task navigation and Stack; parent context stays visible through the task trail and focus is restored on child return.
- Every committed cleanup above passed full `npm run verify` before its one-shot workflow committed it.

## Resume here

At the start of every session:

1. read this document;
2. compare branch to current `main` and record any incoming divergence before editing;
3. inspect the latest branch verification run; keep the head green before moving into a higher-risk slice;
4. audit current branch for any remaining ordinary `custom` resource-picker escape hatches before deleting that legacy custom role;
5. remaining Commands Author migration target: per-target Reference Source editor first if it can be moved to structured grammar without duplicating persistence; Player Command editor remains the more complex final Commands legacy surface;
6. next runtime target: inspect Narrative presentation boundaries and Session lifecycle ownership, then choose the smaller isolated extraction rather than mixing them;
7. after every App/runtime extraction, re-audit direct feature imports/branches and require a fresh full verification checkpoint;
8. before merge: run final full verification, perform the manual Author acceptance route, and **delete `.github/workflows/verify-author-ux-refactor.yml`**;
9. update this document before ending any session where meaningful work occurred.
