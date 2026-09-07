# Author UX + Integration Refactor — Live Handoff

Branch: `author-ux-integration-refactor`
PR: #182
Base: `main`
PR remains **draft / unmerged**.

Last fully verified **code** head: `8106149217b233fb457af45122bdb31943eb0b5e`
Verification workflow run: `34150653842` — **SUCCESS**
At the last main comparison before this final repair, the branch was 0 behind `main`; re-check immediately before merge.

Emergency pre-merge production anchor:

- branch: `rollback/pr182-premerge-main`
- commit: `02d5ac8cb77556094bf6c83c8c9721d0c8940c1c`
- this is the exact `main` commit PR #182 was based on and the known-good production source before the refactor.

> This file is the recovery point for a new conversation. Always fetch PR #182 first because updating this handoff itself advances the branch head beyond the last verified code SHA above.

## Non-negotiable project rules

1. Play stays play; Author augments the real running game.
2. Seen means editable through the resource's canonical owner editor.
3. One resource, one owner, one durable save path.
4. Nested work preserves parent draft/context and returns to it; Back stays inside Author; master X returns to play.
5. Features communicate through resource/capability/task contracts, not embedded duplicate editors.
6. Testing/current-run actions are not alternate persistence paths.
7. Mobile and desktop share tasks/editors/mutations/save semantics; responsive presentation alone may differ.

## Current technical assessment

All definite PR-specific static/runtime blockers found by repeated independent audits have now been repaired and the exact latest code head is green.

The branch is **not yet merged** because remaining uncertainty is predominantly real-device acceptance plus final branch hygiene. Since the live site is the only practical environment available to the user for true iPhone/desktop acceptance, treat the eventual merge as a controlled production canary with the rollback procedure below rather than as an irreversible release.

## DONE — major repaired audit findings

### Commands

- illegal nested structured sections removed;
- dynamic `{placeholder}` target slots normalize when wording changes;
- target aliases with real candidates validate;
- semantic `list` presentation replaces giant no-wrap resource/action buttons;
- regression tests build the previously crashing dynamic workspace states.

### Synth

- authored sounds use semantic identity list rows;
- tactile note/pitch controls retained;
- procedural playback uses shared AudioContext;
- rapid pitch audition replaces/fades the previous preview instead of allocating one AudioContext per semitone.

### Nested task lifecycle

- successful Delete/Reset no longer routes through dirty Back protection;
- typed resource completion returns to suspended parents;
- successful deletion uses explicit `resource-deleted` completion;
- failed/conflicted optimistic deletion cannot mutate the parent reference;
- parent reference reconciliation depends on authoritative child completion, not temporary option-list disappearance.

### Durable operation lock

- shared ref-counted Author commit state exists in `src/author/tasks/commitState.ts`;
- foreground Save/Delete/Reset operations enter the commit boundary;
- structured Save keeps the outer lock until typed child completion is delivered;
- runtime refuses task navigation while commit is pending;
- shell navigation and structured feature UI are visually inert/disabled while pending;
- `completeTask()` remains legal so accepted nested work can return to the parent;
- deferred/overlapping commit tests are present.

### Background offline-sync race — latest repair

Audit found that standalone `flushQueuedAuthorMutations()` shared the synchronization queue but did not share the Author commit boundary. A reconnect/15-second background flush could therefore advance D1 while a foreground Save had already captured the old revision, producing a self-generated conflict.

Repair now in `src/author/persistence/authorProjectPersistence.ts`:

- automatic queue flush enters the **same `withAuthorCommit(...)` boundary** as foreground writes;
- foreground and background synchronization still use one serialized queue;
- successful writes remember the latest snapshot published by this browser;
- a waiting foreground mutation may rebase to that revision **only when project content (ignoring revision) exactly matches its pre-save snapshot**;
- if background synchronization observed a real external project change, content differs and the foreground edit still produces an ordinary revision conflict rather than silently overwriting it.

Tests in `tests/authorPersistence.test.ts` now cover both directions:

1. queued background write R10→R11 followed by same-browser foreground save => foreground writes at R11 and succeeds, no self-generated 409;
2. remote/external content changed before background flush => foreground stale edit is **not** treated as a safe own-browser rebase and remains a conflict.

Latest code head `8106149217b233fb457af45122bdb31943eb0b5e` passed architecture assertions, clean install, complete `npm run verify`, and production Vite build in workflow `34150653842`.

## Network-stall decision

Do **not** add a naive short fetch timeout immediately before merge.

Reason: aborting a POST only proves the client stopped waiting; it does not prove the Worker failed to commit the mutation. Automatically queueing/replaying an ambiguously committed write can duplicate a mutation unless writes have an idempotency/replay key.

The current lock always releases when the promise settles. A truly stalled browser/network request can therefore leave Author temporarily locked, but this is preferable to introducing ambiguous duplicate writes in a last-minute timeout patch. A durable future solution should pair bounded requests with mutation idempotency/replay identity.

The separate pre-existing problem where a permanently rejected offline queue entry may repeatedly block later queue work remains real but existed on `main`; track it separately rather than mixing it into PR #182's final stabilization.

## DONE — smaller audit cleanup

- Author Tools has one Find surface: large Tools Find on Tools, shell Quick Find elsewhere.
- Asset Explorer no longer tells authors to hand-create `.asset.json` sidecars.
- Synth Sounds uses semantic list rows.
- Node -> Input explicit prerequisite Save remains a known creative-flow friction, not a stability blocker; do not add an alternate persistence path.

## Emergency rollback plan

The production workflow `.github/workflows/deploy.yml` supports both push-to-main deployment **and `workflow_dispatch`**.

Before PR #182 is merged, `rollback/pr182-premerge-main` was created at the exact old-main SHA `02d5ac8cb77556094bf6c83c8c9721d0c8940c1c`.

If the live merge is badly broken:

1. In GitHub Actions open **Deploy production**.
2. Run the workflow manually against ref/branch `rollback/pr182-premerge-main`.
3. That branch contains the previous Worker/client code and deployment workflow, so the old Worker + GitHub Pages build can be redeployed without first rewriting `main` history.
4. Verify `/api/health`, `/api/project/snapshot`, and the player surface after rollback deployment.
5. Then make the repository history match production by reverting the PR merge on `main` (prefer GitHub's Revert flow / a normal revert commit rather than force-moving `main`).

Why rollback is comparatively safe here:

- PR #182 introduces no D1 migration;
- no Worker schema change;
- no project mutation schema change;
- no player-save format change;
- the production persistence adapter/deploy format was unchanged through the main refactor.

Important limitation: rolling code back does **not** erase authored project mutations made while the new UI was live. Those use the existing project schema and should remain readable by old code, but a code rollback is not a data-undo operation.

Prefer merging PR #182 with a normal **merge commit**, not rebase, so GitHub retains the PR boundary and a single merge can be reverted cleanly while preserving the branch's incremental history.

## Before merge — remaining gates

1. Re-fetch PR #182 and compare against `main`; require 0 behind.
2. Prefer one more independent audit of the post-sync-race code head or later.
3. Do not add unrelated UX/features after the final audit.
4. Keep this handoff and the temporary verifier until the final merge decision because they are the branch recovery system.
5. Immediately before merge:
   - remove `.github/workflows/verify-author-ux-refactor.yml`;
   - remove or distill `docs/author-ux-integration-refactor-plan.md`;
   - remove this handoff if it should not become durable project documentation;
   - inspect the final diff to ensure only intended production files remain.
6. Merge only with explicit user direction.
7. Treat the live deployment as the real-device acceptance window. Test iPhone + desktop immediately, especially nested task return/focus, keyboard-open layouts, Synth touch controls, Narrative interaction authoring, and ordinary player/Radix behavior.
8. If anything is catastrophically broken, use the rollback deployment branch above first; diagnose second.

## High-value live acceptance route

After controlled merge/deploy, immediately test:

- nested reference -> `+ CREATE` -> child Save -> parent receives selected resource exactly once;
- while Save is pending, Back/Tools/Find/Stack/breadcrumb/X cannot navigate;
- nested referenced deletion success clears only that parent reference;
- rejected/conflicted deletion leaves parent unchanged;
- Save All after nested return saves newly dirtied parent;
- Commands target placeholder edit/rename/remove;
- Synth rapid pitch drag + note audition on iPhone;
- Vector touch editing;
- Narrative valid input / fallback / destination create-edit-return;
- player Narrative continuation/transitions/effects;
- Radix startup/presentation;
- ordinary save/load and existing project data.

## Fresh-conversation continuation order

1. Fetch PR #182 and read this file.
2. Compare branch to `main`.
3. Check latest workflow run for the actual current head.
4. If a new audit finding exists, repair only that finding and add a regression test.
5. Update this handoff after every meaningful repair.
6. Do not merge automatically; wait for explicit user instruction.
7. When merge is authorized, perform final temporary-file cleanup, re-check diff/main divergence, use merge-commit strategy, observe production deploy, then execute the live acceptance checklist.
