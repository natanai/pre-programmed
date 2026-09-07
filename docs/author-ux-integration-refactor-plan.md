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

### Phase 1 — shared Author interaction improvements (low risk)

- [x] Improve canonical resource/reference interaction so selected resources can be edited directly without first opening a chooser.
- [x] Reduce redundant instructional copy in shared reference UI.
- [x] Make task-trail ancestors actionable where safe, using the existing task runtime and dirty-state protections rather than feature-specific navigation.
- [ ] Improve return-from-child continuity (focus/scroll/highlight where practical without changing save semantics).
- [ ] Normalize shared action language and spacing where current shared components visibly disagree.

Implementation notes:

- `ReferenceField` now exposes a visible `[EDIT]` action for its selected canonical resource. The chooser remains the ordinary primary interaction.
- Clean Author task ancestors in the task trail are clickable. A jump is disabled if any descendant task is dirty; dirty work therefore keeps the pre-existing Back/save/discard semantics rather than introducing a second exit path.

### Phase 2 — contextual actions and mobile acceleration (low risk)

- [ ] Define one shared Author contextual-action model/component.
- [x] Add shared press-and-hold support for eligible Author resources/list rows. Initial use: selected `ReferenceField` resources.
- [x] Provide an ordinary visible/button route for every long-press action. `ReferenceField` long-press and `[EDIT]` call the same canonical resource editor.
- [ ] Provide a desktop equivalent beyond the already-visible action (for example a future shared context-menu presentation) only if it improves use without duplicating behavior.

Implementation notes:

- `src/author/ui/useAuthorLongPress.ts` is a coarse-pointer accelerator only. It ignores mouse input and owns no authored state, validation, editor, mutation, or persistence behavior.

### Phase 3 — incremental legacy Author migration (low/moderate risk)

Migrate ordinary fields/selects/toggles/choices/disclosures from unrestricted workspaces into the shared semantic workspace grammar while leaving genuinely specialized controls custom.

Priority order for remaining legacy feature surfaces:

1. Narrative
2. Media
3. Commands

Do this section-by-section when it improves usability; do not rewrite all editors at once.

- [ ] Narrative legacy surface reduced
- [ ] Media legacy surface reduced
- [ ] Commands legacy surface reduced
- [x] Project removed from legacy feature rendering.
- [x] Remove entries from `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` only when their unrestricted workspace path is genuinely gone. `project` was removed; remaining exceptions are Narrative, Media, Commands.

Project cleanup notes:

- `type: "workspace"` routes (Run navigation / History) are core Author routes, not feature routes.
- Their existing `WorkspacePanel` already lives under `src/author/workspace`.
- Dispatch of those routes moved from `projectAuthorFeature.renderWorkspace` to the shared Author registry without changing the panel, APIs, run-navigation behavior, persistence calls, or node-edit resource route.
- The old unused `WorkspacePanel.onClose` prop was removed; Back/X remain owned by the shared Author host.

### Phase 4 — isolated runtime integration refactors (moderate risk)

These should be separate, behavior-preserving commits after UX/shared-layer work is stable.

- [ ] Reduce Radix-specific startup/presentation knowledge in `App.tsx` through a presentation/runtime contribution.
- [ ] Move Narrative player presentation/execution semantics behind a Narrative-owned runtime contribution rather than calculating them directly in App.
- [ ] Consolidate complete play-session lifecycle ownership under Session.
- [ ] Re-audit direct feature imports/branches in App after each extraction.

## Safety / verification strategy

For every change:

1. Keep durable mutations and save functions in their current owner.
2. Prefer extending shared Author contracts/components over adding feature-specific UI branches.
3. Verify both root and nested Author tasks.
4. Verify dirty parent draft survives child open/save/back.
5. Verify master X still returns to play rather than acting as task Back.
6. Verify mobile and desktop use the same underlying action/task.
7. Run `npm run verify` when executable CI/tooling access is available.
8. Manually test representative nested flows after meaningful UI changes.

Suggested manual acceptance route:

- enter Author mode from live play;
- edit a current Narrative resource;
- follow/edit a referenced State/World/Inventory/Media resource from context;
- on mobile, long-press a selected reference and confirm it opens the exact same editor as `[EDIT]`;
- create a child resource, save it, and confirm the parent draft resumes with the new reference selected;
- create a 3+ task clean stack and tap an ancestor to return directly;
- make a descendant dirty and confirm older ancestors are not jumpable until that dirty task is resolved;
- open/close Quick Find and task stack on narrow/mobile presentation;
- open Run navigation and History and confirm both still behave exactly as before the Project legacy-render cleanup;
- return to play with X;
- confirm ordinary player behavior remains unchanged.

## Verification status

- Branch currently has no push-triggered CI workflow. Production deploy runs only on `main`; the portable workflow is not a general branch verification workflow.
- The current work has therefore received static source/diff review only so far.
- `npm run verify` and live manual Author testing remain required before merge.
- Do not merge this branch solely on the basis of the source review recorded here.

## Change log

### 2026-09-06

- Created branch from current `main` at `02d5ac8cb77556094bf6c83c8c9721d0c8940c1c`.
- Added this living plan before implementation.
- Added direct `[EDIT]` access beside selected shared resource references.
- Removed repeated nested-task explainer copy from `ReferenceField`; the task trail and controls now carry that interaction model.
- Added shared coarse-pointer long-press accelerator and wired selected references to their existing canonical edit action.
- Made clean task-trail ancestors directly navigable; dirty descendants block the shortcut and retain existing Back/dirty-confirmation semantics.
- Moved Run navigation / History dispatch out of Project's unrestricted feature renderer and into the shared Author registry.
- Removed `project` from `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS`; remaining legacy features are Narrative, Media, Commands.
- Removed the obsolete unused `WorkspacePanel.onClose` prop.
- Compared branch to `main`; changes are limited to the documented Author shared layer, Project routing cleanup, and this plan. No `App.tsx`, runtime gameplay, mutation, persistence, or worker files have been changed.

## Resume here

At the start of each new work session:

1. read this document;
2. compare branch to current `main` for incoming changes;
3. update the Change log with any upstream merge/rebase decision;
4. first obtain executable verification if available (`npm run verify`); if not, continue only low-risk shared/presentation work;
5. next UX target: return-from-child continuity and shared action-language normalization;
6. next audit target: inspect Narrative/Media/Commands for the smallest ordinary UI section that can move to structured Author primitives without touching runtime semantics;
7. record completed changes and verification before ending the session.
