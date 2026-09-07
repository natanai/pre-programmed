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
- Main Author debt: Narrative, Media, Commands, and Project still include legacy unrestricted Author workspace rendering.
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

- [ ] Improve canonical resource/reference interaction so selected resources can be edited directly without first opening a chooser.
- [ ] Reduce redundant instructional copy in shared reference UI.
- [ ] Make task-trail ancestors actionable where safe, using the existing task runtime and dirty-state protections rather than feature-specific navigation.
- [ ] Improve return-from-child continuity (focus/scroll/highlight where practical without changing save semantics).
- [ ] Normalize shared action language and spacing where current shared components visibly disagree.

### Phase 2 — contextual actions and mobile acceleration (low risk)

- [ ] Define one shared Author contextual-action model/component.
- [ ] Add shared press-and-hold support for eligible Author resources/list rows.
- [ ] Provide an ordinary visible/button route for every long-press action.
- [ ] Provide a desktop equivalent (visible action or context menu) without creating separate feature behavior.

### Phase 3 — incremental legacy Author migration (low/moderate risk)

Migrate ordinary fields/selects/toggles/choices/disclosures from unrestricted workspaces into the shared semantic workspace grammar while leaving genuinely specialized controls custom.

Priority order:

1. Narrative
2. Media
3. Commands
4. Project

Do this section-by-section when it improves usability; do not rewrite all editors at once.

- [ ] Narrative legacy surface reduced
- [ ] Media legacy surface reduced
- [ ] Commands legacy surface reduced
- [ ] Project legacy surface reduced
- [ ] Remove entries from `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` only when their unrestricted workspace path is genuinely gone.

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
- create a child resource, save it, and confirm the parent draft resumes with the new reference selected;
- navigate back within nested Author work without losing unsaved parent state;
- open/close Quick Find and task stack on narrow/mobile presentation;
- return to play with X;
- confirm ordinary player behavior remains unchanged.

## Change log

### 2026-09-06

- Created branch from current `main`.
- Added this living plan before implementation.
- Initial implementation target: shared resource/reference UI, task-stack navigation, then contextual mobile actions.

## Resume here

At the start of each new work session:

1. read this document;
2. compare branch to current `main` for incoming changes;
3. update the Change log with any upstream merge/rebase decision;
4. continue the earliest unchecked low-risk item unless current code changes make another item safer;
5. record completed changes and verification before ending the session.
