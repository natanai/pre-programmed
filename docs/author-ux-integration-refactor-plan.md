# Author UX + Integration Refactor Plan

Branch: `author-ux-integration-refactor`
Started: 2026-09-06

## Goal

Improve Author mode usability and consistency while paying down the architectural debt identified in the September 2026 systems audit. Preserve the running engine, resource ownership, task semantics, persistence paths, mutation formats, and player behavior.

The guiding rule for this branch is:

> Improve presentation and shared interaction contracts first. Do not casually combine a UX change with a runtime rewrite.

## Current merge-readiness status

- All feature Author workspaces are now data-first/structured.
- `renderWorkspace` and `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` have been removed from the Author architecture entirely.
- Narrative Interaction, Media File/Vector/Synth, Commands, Project, State, Inventory, World, and Radix all use the shared workspace lifecycle.
- Specialized controls remain feature-owned inside structured tasks; they do not own parallel durable save paths.
- Radix and the selected Narrative presentation/runtime seams have been extracted from `App.tsx` in independently verified slices.
- Session lifecycle consolidation remains a separate follow-up architecture project and is not a merge blocker for this Author UX branch.
- Remaining merge gates: final branch-wide verification, real mobile/desktop acceptance, remove the temporary branch verifier, and confirm the branch is still 0 behind `main`.

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
8. Unrestricted feature-level workspace rendering is not part of the Author feature contract.

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
- [x] Audited the live branch for `custom` resource-picker escape hatches; migrated the ordinary Radix synth selector to semantic `resource`, reclassified Narrative Node context as a genuine composite `specialized-control`, and removed the `resource-picker` role from the grammar.

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
- [x] Interaction editor duplicate outer frame and task-level Back removed; shared task navigation owns Back/X while `[‹ INPUT]` remains internal response/settings navigation.
- [x] Interaction normalization, validation, persisted-shape construction, and save descriptions centralized in Narrative-owned authoring semantics.
- [x] Interaction response/settings UI split into a controlled specialized composer with no persistence or dirty-baseline ownership.
- [x] Interaction resource draft, dirty state, validation, Save/Delete, nested completion, and persistence moved to `interactionWorkspace`.
- [x] Narrative `renderWorkspace` and its legacy self-owning Interaction wrapper physically removed after the structured live route passed full verification.

#### Media

- [x] Synth Sounds list moved to structured Author workspace; old legacy Synth list branch removed.
- [x] Media Assets browser moved to structured Author workspace as a specialized control.
- [x] Duplicate Asset Explorer Author frame/header removed.
- [x] Obsolete Asset Explorer close prop removed.
- [x] Migrated legacy `assets` and `synth` branches physically removed rather than left unreachable.
- [x] File Media, Vector, and Synth editors no longer draw duplicate Author task frames/titles or task-exit buttons; shared Author owns task navigation while editor-specific Save/Play/Export/Delete/Reset remain feature-owned.
- [x] Obsolete `SynthPanel` list component and its dead list/back CSS removed after branch-native proof that the structured Synth library is the only list owner.
- [x] File Media metadata lifecycle moved to a structured workspace; vector-grid images route directly to their owning Vector workspace.
- [x] Synth durable draft/save lifecycle moved to a structured workspace while the sequencer remains a specialized controlled interaction.
- [x] Vector durable draft/save lifecycle moved to a structured workspace with async canonical-draft adoption; canvas tools/undo/redo/zoom remain local transient interaction state.
- [x] Media `renderWorkspace` removed and superseded File/Vector/Synth legacy editor wrappers physically deleted.

#### Commands

- [x] Player Interactions route moved to structured Author workspace.
- [x] Player Commands list (`grammar` / `capabilities`) moved to structured Author workspace.
- [x] Target Names + Aliases list moved to structured Author workspace.
- [x] Target Behavior list moved to structured Author workspace.
- [x] Deleted the four now-unreachable legacy route components, their old renderer branches, the helper used only by them, and migrated list-route CSS instead of leaving prototype UI dormant.
- [x] Per-target Reference Source editor moved to structured Author grammar using the same Commands-owned `project.settings` persistence path; old editor branch and CSS were physically removed.
- [x] Player Command editor moved to structured Author grammar while retaining authored text/effects as specialized feature-owned controls.
- [x] Shared structured save boundary now supports prerequisite saves without completing a resource task, preserving save-before-nested-target editing without a Commands-only mutation path.
- [x] Commands `renderWorkspace` removed and `commands` removed from `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS`.

#### Legacy renderer removal

- [x] Every feature workspace now enters through a structured workspace definition.
- [x] The registry's unrestricted workspace fallback and legacy exception set were removed.
- [x] `renderWorkspace` was removed from `AuthorFeatureManifest`, so unrestricted feature-level workspace rendering can no longer be reintroduced accidentally.

### Phase 4 — isolated runtime integration refactors

Do only in behavior-preserving, independently verified slices.

- [x] Reduce Radix-specific startup/presentation knowledge in `App.tsx` through a feature-owned runtime presentation controller.
  - `useRadixRuntimePresentation` owns startup sequence selection, active run state, sequence reconciliation, synth resolution, completion, effect-triggered runs, and Radix surface rendering.
  - App retains only generic launch-blocking coordination and the controller's narrow capabilities.
- [x] Move Narrative player presentation/execution semantics behind Narrative-owned runtime contracts without hiding legitimate composition-root dispatch.
  - [x] `useNarrativePlayerSurface` owns current node, anchor, graph notation, fallback interaction/notation, choice visibility, and immediate/menu choice derivation.
  - [x] `resolveNodeOpeningPresentation` and memoized `useNarrativeContinuation` own node/interaction prose interpolation, text-notation compilation, speaker resolution, authored source identity, and follow-up prose payloads while App retains timing/state setters.
  - [x] `executeInteraction` returns the selected outcome's narration/dialogue performances, so App no longer reinterprets the outcome through `interactionOutcomeProse`.
  - [x] Interaction execution now returns the exact narration/dialogue presentation source while keeping effect-event provenance outcome-level; App no longer assigns Narrative prose sections itself.
  - [x] Re-audit concluded `executeInteraction(...)` is an appropriate composition-root call: App dispatches a parsed Interaction into its owning runtime but no longer contains the feature-specific interpretation around that call. Do not add an abstraction whose only purpose is hiding this import.
- [ ] Consolidate complete play-session lifecycle ownership under Session. **Deferred follow-up; not a merge blocker for this branch.**
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

The verifier intentionally has no single-run concurrency lock; a previously stuck GitHub runner should not block verification of a newer branch head.

### Successful verification checkpoints

Full `npm run verify` has passed after:

- initial shared Author/resource/task changes;
- Commands navigation/list structured migrations;
- Media Synth list migration;
- Narrative Story Structure migration;
- generic nested return-focus behavior;
- Media legacy cleanup;
- Media Assets structured browser migration;
- embedded Structure/shared-shell cleanup;
- creation and App installation of the Radix runtime presentation controller;
- an independent ordinary branch run after the Radix App extraction;
- physical deletion of migrated Commands route components/styles;
- Inventory Body Type background migration to semantic `resource`;
- State Player Presentation group migration to semantic `resource`;
- removal of redundant nested-return mechanics copy from the shared Author shell;
- an independent ordinary branch run over the consolidated post-Radix Author cleanup;
- creation and App installation of `useNarrativePlayerSurface`;
- creation of the Narrative prose presentation resolver and its memoized continuation hook;
- App delegation of node-opening and follow-up prose presentation to those Narrative-owned contracts;
- expansion of `executeInteraction` to return presentation performances;
- removal of App's duplicate `interactionOutcomeProse` interpretation;
- Commands per-target Reference Source structured migration using shared Commands persistence;
- branch-native audit and removal of the obsolete `custom` `resource-picker` role;
- full Player Command structured migration and removal of Commands from the legacy Author exception list;
- Narrative Interaction duplicate task-chrome cleanup;
- Media specialized-editor task-chrome cleanup and deletion of the superseded Synth list component;
- Interaction narration/dialogue provenance extraction from App into Narrative runtime, with effect provenance preserved separately.

One-shot workflows are used only for mechanically editing large files when connector reads are chunked. They assert exact source shape, run full `npm run verify`, commit only on success, and remove themselves. Failed assertions therefore leave the intended source change uncommitted.

Long inline Python in one temporary Narrative workflow was rejected by GitHub before job creation. No source patch ran. The reliable pattern is now a temporary `.github/scripts/*.py` plus a small workflow that invokes it; both self-delete after a verified commit.

GitHub does not recursively trigger push workflows from a `GITHUB_TOKEN` push, so human-authored plan/checkpoint commits are used to trigger independent normal branch verification after groups of bot-committed verified changes.

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
- verify nested Author navigation no longer displays `SAVE RETURNS TO …` helper copy;
- open Player Interactions, Player Commands, Target Names + Aliases, and Target Behavior after their structured migration;
- edit/create/delete a Player Command through the structured task, including response speaker/text/effects and target-operation setup;
- from a dirty/new target-operation command, open a target owner's behavior editor and confirm the command saves first without returning from its resource task;
- edit a per-target Reference Source through the structured task;
- edit a Body Type background image and confirm the shared Media chooser/preview/Edit/Create behavior;
- edit a State value's Player Presentation group and confirm the shared State Group reference behavior;
- open Story Structure and verify search/path/legend/node/interaction editing still work;
- open an Interaction as a nested task and confirm shared Author is the only task-level Back while `[‹ INPUT]` still navigates from Response/Input Settings to the interaction overview;
- open Media Assets and Synth Sounds and verify their browser/list behavior still opens the same canonical editors;
- open File Media, Vector, and Synth editors and confirm shared task Back/X replaces their old Close/Cancel/frame while Save/Play/Export/Delete/Reset still work;
- test Narrative immediate/prompt/hidden choices, invalid fallback notation, node anchors, narration→dialogue continuation, interaction narration→dialogue continuation, speaker context, transitions, and entry effects after the runtime extraction;
- test Radix startup presentation, effect-triggered Radix presentation, Author Edit Sequence/Edit Source affordances, and resume to node text after startup;
- test narrow/mobile presentation with keyboard open;
- confirm ordinary player behavior remains unchanged.

## Current branch relationship

- Merge base remains the current `main` head from branch creation unless a later comparison says otherwise.
- Acceptance audits during this branch have repeatedly shown **0 commits behind `main`**; re-check immediately before merge.
- `App.tsx` remains net smaller than the branch-start `main` snapshot despite installing Radix and Narrative integration contracts.
- No project mutation formats, durable persistence formats, Worker persistence, or gameplay save schema were changed by the Author workspace migrations or the isolated Radix/Narrative presentation extractions.
- Temporary verification scaffolding must be deleted after the final real-device acceptance pass and before merge.

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

### 2026-09-06 — first runtime ownership extraction

- Added feature-owned `useRadixRuntimePresentation`.
- Moved Radix startup selection, active presentation state, deleted-sequence reconciliation, synth resolution, completion, effect-triggered presentation, and UI rendering out of App.
- Replaced App's direct Radix implementation knowledge with a narrow controller capability surface.
- Post-commit source audit confirmed direct Radix implementation details are gone from App.
- Independent normal branch `npm run verify` subsequently passed on the Radix-integrated head.

### 2026-09-06 — post-Radix Author cleanup

- Physically deleted migrated Commands route components and dead CSS while preserving Player Command / Reference Source editor ownership and persistence unchanged.
- Migrated Inventory Body Type background image from a custom `ReferenceField` escape hatch to the shared semantic `resource` node.
- Migrated State Player Presentation group selection from a custom `ReferenceField` escape hatch to the same semantic `resource` node.
- Removed `SAVE RETURNS TO …` from shared task navigation and Stack; parent context stays visible through the task trail and focus is restored on child return.
- Independent normal branch verification passed over the consolidated cleanup head.

### 2026-09-06 — Commands Reference Source + resource-picker cleanup

- Moved per-target Reference Source editing into structured Author grammar using shared toggles, fields, sections, and contextual actions.
- Centralized Commands author settings persistence helpers so the structured Reference Source task and remaining Player Command editor share one mutation path.
- Removed the old Reference Source legacy renderer branch and its route-specific CSS rather than leaving it unreachable.
- Branch-native audit found only two `custom` `resource-picker` roles: Radix synth selection and the composite Narrative Node context strip.
- Migrated Radix synth selection to semantic `resource`; retained Node context as a specialized composite because it owns Set / Continue / Clear context semantics rather than acting as an ordinary picker.
- Removed `resource-picker` from the shared `AuthorUiCustom` role union so new ordinary resource fields cannot regress to that escape hatch.

### 2026-09-06 — complete Commands structured migration

- Migrated the Player Command editor to the shared data-first Author task system.
- Kept ordinary command controls in the semantic grammar and retained Authored Text / Outcome Effects only as specialized feature-owned controls inside the shared shell.
- Added a generic `saveCurrentDraft({ completeTask: false })` structured-task capability so a parent can satisfy a nested editor prerequisite through its one canonical save boundary without accidentally completing/returning a resource task.
- Preserved Player Command validation, automatic target-source enablement, create/edit resource completion, delete confirmation, and save-before-target-owner nesting.
- Removed Commands' unrestricted `renderWorkspace` contribution and removed `commands` from the legacy exception list; only Narrative and Media remain.
- The migration passed full `npm run verify`; an independent normal branch verification is triggered by this checkpoint staging commit.

### 2026-09-06 — remaining legacy editor shell cleanup

- Removed the Interaction editor's redundant outer Author frame and task-level Back. The shared task stack is now the only Author-task Back/X surface; the editor's `[‹ INPUT]` remains correctly scoped to its internal response/settings navigation.
- Removed duplicate outer frames/titles and visible Close/Cancel task-exit controls from File Media and Vector editors; Synth received the same outer-frame cleanup.
- Kept Media `onCancel` callbacks only as private lifecycle completion hooks after successful delete/reset, not as an alternate Author navigation path.
- Deleted the obsolete `SynthPanel` list component and its list/back CSS after asserting no component-symbol consumers remain; the structured Synth library is the single list owner.
- Both cleanup slices passed full `npm run verify`. These changes deliberately do **not** remove Narrative or Media from the legacy exception list because their specialized draft/save internals have not yet moved into the shared structured controller.

### 2026-09-06 — Narrative runtime ownership extraction

- Added `useNarrativePlayerSurface`; App no longer constructs the Narrative graph, evaluates choice visibility, resolves node anchors, or derives fallback/input notation and terminal choices itself.
- Added Narrative-owned prose presentation resolution for node openings and node/interaction continuation dialogue.
- Added memoized `useNarrativeContinuation` so React effect dependencies retain stable payload identity and do not replay follow-up prose on unrelated renders.
- App retains the timing effects and React presentation state setters but consumes resolved Narrative payloads instead of calculating interpolation, notation compilation, conversation speaker, or authored source identity itself.
- Expanded `InteractionExecution` with narration/dialogue performances and removed App's second interpretation of the selected outcome via `interactionOutcomeProse`.
- Moved the remaining Interaction prose-section provenance decision into Narrative runtime: displayed text gets narration/dialogue source identity there, while effect events retain their outcome-level source.
- Re-audited App and accepted direct `executeInteraction(...)` as the composition-root dispatch boundary; App no longer contains Narrative-specific interpretation around that call.
- Every source and App-wiring slice above passed full `npm run verify` before/while committing.

## Resume here

At the start of every session:

1. read this document;
2. compare branch to current `main` and record any incoming divergence before editing;
3. inspect the latest branch verification run; keep the head green before moving into a higher-risk slice;
4. for Narrative Interaction or Media specialized editors, migrate only by moving real draft/save lifecycle into the shared structured controller; do not wrap the existing stateful editor wholesale as `custom` merely to remove an exception id;
5. treat the Narrative runtime/App boundary as settled unless new feature-specific interpretation is added to App; `executeInteraction(...)` itself is an intentional composition-root dispatch call;
6. do not begin the broader Session lifecycle move until the remaining lower-risk Author/runtime slices are stable; Session crosses saved-game compatibility and autosave semantics;
7. after every App/runtime extraction, re-audit direct feature imports/branches and require a fresh full verification checkpoint;
8. before merge: run final full verification, perform the manual Author acceptance route, and **delete `.github/workflows/verify-author-ux-refactor.yml`**;
9. update this document before ending any session where meaningful work occurred.
