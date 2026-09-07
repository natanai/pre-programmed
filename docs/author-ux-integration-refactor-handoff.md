# Author UX + Integration Refactor — Live Handoff Log

Branch: `author-ux-integration-refactor`
PR: #182 — **draft / do not merge yet**
Base: `main`
Last fully verified code head before this handoff-only commit: `66e6e8ee3a853c0df217617f2fe54e17833421f3`
Verified workflow run: `34146807830` — **success**
Branch comparison at that checkpoint: **236 ahead / 0 behind `main`**

> This file is the recovery point for continuing this branch from a fresh ChatGPT conversation. Keep it current after every meaningful repair/verification pass. Updating this file itself advances the branch head, so always fetch PR #182’s actual head before editing; use the “last fully verified code head” above to distinguish a documentation-only head advance from the last code checkpoint.

## Product / architecture rules that must remain true

1. Play stays play; Author augments the real running game.
2. Author tools manage canonical authored systems; do not clone player surfaces just to edit them.
3. Seen means editable: canonical editor reachable from every Author reference.
4. One resource, one owner, one save path.
5. Editing is additive to normal navigation/play behavior.
6. Nested editing opens the owning Author task, preserves the parent draft, and returns to it when complete. Back stays within Author tasks; master X returns to play.
7. Player-visible authored output retains provenance sufficient to reopen its definition.
8. Features communicate through task/resource/capability contracts rather than embedding each other’s editors.
9. Testing/current-run controls must not become alternate durable authoring paths.
10. Mobile and desktop share the same tasks/editors/mutations/save semantics; only responsive presentation differs.

## Current merge decision

**DO NOT MERGE YET.**

The two lifecycle/persistence blockers from the latest branch-wide audit now have shared architectural repairs and the latest code checkpoint is green. The remaining merge gates are primarily real-device/manual acceptance, final branch hygiene, and removal of temporary branch-only verification/planning material—not known failing automated checks.

Do not infer “merge ready” solely from CI. The branch changes Author navigation, nested resource lifecycle, responsive presentation, and several specialized editors; the explicit manual acceptance below is still required.

## DONE — blocker A: durable operations cannot race Author navigation

### Shared durable-operation lock

- Added `src/author/tasks/commitState.ts` with a ref-counted Author commit-in-progress state.
- `persistAuthorMutation()` enters that shared lock, so durable project Save/Delete/Reset operations participate automatically instead of each feature inventing its own navigation lock.
- Structured workspace Save holds an **outer** commit token through persistence **and typed child completion**. Its inner project persistence may also hold a token; reference counting prevents premature unlock.
- `useAuthorTaskRuntime` refuses user stack-changing operations while any commit is pending:
  - open/replace task;
  - push child task;
  - Back;
  - Close/X;
  - discard/leave confirmation;
  - direct close-all.
- `completeTask()` intentionally remains legal while locked. This is required so the already-accepted child can return its typed result to the suspended parent before the outer commit scope releases.
- `AuthorWorkspaceRenderer` makes structured feature controls inert while any durable Author write is pending.
- `AuthorWorkspaceHost` also makes shared shell navigation visibly/intractably unavailable while pending:
  - `[X]` disabled;
  - navigation marked busy/inert, covering Back, Tools, Quick Find, Stack and breadcrumb/task jumps;
  - preview resume disabled.
- Runtime guards remain underneath presentation-level `disabled`/`inert`, so safety does not depend on DOM styling.
- `pushTaskWithReturnFocus` ignores a blocked empty task id instead of recording an invalid return-focus entry.

### App persistence boundary sanity check

Checked the current branch’s `App.tsx` author persistence caller. It:

1. computes the optimistic snapshot synchronously;
2. applies `setSnapshot` / optimistic play-state updates synchronously;
3. sets `SAVING...`;
4. immediately calls/awaits `persistAuthorMutation()`.

There is **no `await`, timer, requestAnimationFrame, or other browser-yielding gap before `persistAuthorMutation()` acquires the shared commit lock**. A second shell interaction therefore cannot run between optimistic application and lock acquisition.

## DONE — blocker B: parent references reconcile only from authoritative child completion

### Removed optimistic-disappearance inference

`ReferenceField` no longer watches its option list and clears a selected reference simply because an optimistic snapshot temporarily stopped listing it. The removed `previousSelectionRef` behavior was the source of the failed/conflicted-delete collateral parent mutation.

### Explicit deletion result

`AuthorTaskResult` now includes:

```ts
{
  type: "resource-deleted";
  kind: string;
  id: string;    // stable owner id
  value: string; // reference value exposed by the provider before deletion
}
```

The separate `value` matters for resource kinds whose stable owner id and authored reference value can differ.

### Generic resource-contract derivation — no per-feature delete fork

Deletion completion is now derived centrally from the resource contract rather than patched into every feature owner.

For a feature task opened with `route.data.resourceTask`:

- the shared task surface wraps that task’s ordinary `context.persist(...)`;
- before the write it gets the owner resource provider’s canonical list from the current snapshot;
- after a **saved or queued** result it gets the same provider’s list from the accepted result snapshot;
- `authorResourceDeletionResult(...)` reports a deletion only when exactly one previously available resource of that canonical kind disappeared by stable owner id;
- the task stores that typed result for its normal `leaveCurrentTask()`;
- failed/conflicted persistence stores no deletion result.

This is intentionally feature-independent. State, Inventory, Narrative, Commands, Media, Radix, World and future canonical resource kinds continue using their real owner task and real persistence path.

Important edge case handled: a Media “reset to repository” may delete a D1 override while the canonical repository asset still exists. Because the owner provider still lists the resource after the accepted write, the shared contract correctly treats that as **survival**, not resource deletion.

### Parent reconciliation

`ReferenceField` captures both the reference’s value and stable selected id before entering the child editor. On child completion:

- no result / cancelled / failed / conflicted / unrelated result => parent unchanged;
- matching `resource` result => adopt returned value;
- matching `resource-deleted` by value or stable id => clear the reference;
- no snapshot-membership inference occurs in the parent.

For State Group specifically, clearing the resource field still flows through State’s existing canonical `onChange`, which converts the presentation to `null` / INTERNAL ONLY. A rejected deletion never sends the deletion result, so the suspended parent keeps its original group reference.

## DONE — adversarial automated coverage

`tests/authorCommitLifecycle.test.ts` covers:

- a deferred durable operation keeps Author navigation disallowed until the promise settles;
- overlapping outer + inner commit scopes do not unlock until both release;
- accepted before/after resource lists produce the typed deletion result;
- surviving resource (including reset-style behavior) produces no deletion;
- ambiguous multi-resource disappearance produces no inferred deletion;
- no/cancelled/ordinary/unrelated completion leaves parent reference unchanged;
- matching confirmed deletion clears the parent reference;
- stable-id matching works when resource id and reference value differ.

The test suite intentionally remains DOM-light; exact visual shell-click behavior is backed by the same tested commit state plus branch architecture assertions that require both runtime navigation gating and shell `inert` wiring. Real-device interaction remains a manual acceptance gate.

## DONE — temporary verifier updated

`.github/workflows/verify-author-ux-refactor.yml` no longer requires the removed optimistic `previousSelectionRef` behavior.

It now asserts the new shared lifecycle contract, including:

- runtime navigation uses `authorNavigationAllowed()`;
- shared host observes `useAuthorCommitPending`;
- shell navigation uses `inert={commitPending || undefined}`;
- `ReferenceField` does **not** contain `previousSelectionRef`;
- `ReferenceField` uses authoritative `reconciledAuthorReferenceValue`;
- task host uses `authorResourceDeletionResult`;
- existing structured Author/Save-All/ownership invariants remain asserted.

The workflow still performs a clean install and full `npm run verify` after architecture assertions.

## DONE — latest audit UX cleanup

### Synth Sounds uses semantic list grammar

The Synth library now represents authored sounds as identity-bearing `list` rows:

- primary line: sound name;
- secondary detail: `N voice(s) · BPM`;
- row opens the existing canonical Synth task;
- `+ SOUND` remains an action.

It no longer compresses names/metadata into action-row verb buttons.

### One Find surface on Author Tools

- The larger `AuthorToolIndex` Find remains the canonical search on the Tools task.
- Shared shell Quick Find is hidden only while the active task is Tools.
- Shell Quick Find remains available everywhere else.

This avoids two keyboard-summoning search controls for the same Author universe on mobile.

### Asset Explorer no longer teaches manual `.asset.json` ceremony

Live Asset Explorer copy now tells authors to put file media in the appropriate `public/assets/` directory and let the next build index it. It no longer says a neighboring `.asset.json` sidecar must be hand-created.

## Verification checkpoints

### Green blocker-repair checkpoint

Head: `bd6d44d5f4d0faf4833e5f9ccc90e52383717bb8`
Workflow: `34146539430`
Result: **success**

Passed:

- branch architecture assertions;
- `npm ci --no-audit --no-fund`;
- full `npm run verify`.

### Green latest code checkpoint after UX cleanup

Head: `66e6e8ee3a853c0df217617f2fe54e17833421f3`
Workflow: `34146807830`
Result: **success**

Passed:

- branch architecture assertions;
- `npm ci --no-audit --no-fund`;
- full `npm run verify`.

### Main divergence at latest code checkpoint

`main` base / merge-base: `02d5ac8cb77556094bf6c83c8c9721d0c8940c1c`
Branch: **236 commits ahead, 0 behind**.

Re-check immediately before merge; this is a point-in-time statement.

## TODO — manual acceptance / remaining merge gates

### Required real-device Author lifecycle acceptance

On a real iPhone/mobile browser and on desktop (including a narrow/resized Author panel), exercise:

1. **Nested CREATE pending-save race**
   - parent resource reference -> `+ CREATE`;
   - edit child;
   - press Save;
   - while request is pending, attempt Back / Tools / Find / Stack / breadcrumb ancestor / X;
   - navigation must remain unavailable;
   - when write resolves, child completes exactly once;
   - parent receives the new resource exactly once and returns to the same draft/context.

2. **Nested DELETE rejected/conflicted**
   - edit a referenced canonical resource (State Group is the clearest reproduction);
   - start Delete while observing the parent remains mounted/suspended;
   - if persistence rejects/conflicts and canonical snapshot restores, parent must retain its original reference/draft value;
   - child must remain available for retry/correction and no deletion completion may reach parent.

3. **Nested DELETE success**
   - accepted/queued deletion must return the explicit deletion result;
   - parent clears exactly that matching reference and becomes dirty through its ordinary feature-owned `onChange` semantics;
   - unrelated references remain untouched.

4. **Save All**
   - nested child completion dirties a previously clean parent;
   - Save All must re-read the live task stack and save that newly dirty parent before returning to player.

5. **Commit-lock presentation**
   - feature controls and shell navigation visibly stop accepting input while durable writes are pending;
   - controls become available again on saved, queued, failed, or conflicted completion.

### Required broader manual regression acceptance

- iPhone/mobile with keyboard open and closed.
- Desktop at wide and narrow/resizable Author panel widths.
- Narrative Interaction create/edit/delete; response sub-navigation; destination create/edit; fallback/capture modes; Save/return.
- Media File/Vector/Synth structured editors; Synth touch interactions.
- Commands dynamic placeholder target and alias editing regressions.
- Synth rapid audition / shared AudioContext behavior.
- World, Inventory, State, Radix, Media and Narrative capabilities remain present.
- ordinary player behavior, Narrative continuation/transitions/effects and Radix startup/effect presentation remain unchanged.
- existing project data / D1 / player-save compatibility unchanged.

## TODO — optional creative-flow follow-up (not a current data-safety blocker)

Narrative new Node -> Input still requires an explicit prerequisite Save. Desired eventual flow:

`create node -> write node -> Add Input -> transparently persist prerequisite node through the SAME canonical save boundary -> open Input`

If implementing on this branch, reuse the structured workspace’s `saveCurrentDraft({ completeTask: false })` prerequisite-save pattern (as Commands already does for prerequisite target behavior). Do **not** create an alternate mutation/save path. Keep this isolated from the now-green lifecycle repair.

## TODO — final branch hygiene before merge

1. Re-check branch is still 0 behind `main`.
2. Ensure the final code head (after any remaining code change) has a green branch verifier and full `npm run verify`.
3. Remove temporary `.github/workflows/verify-author-ux-refactor.yml` **before merge**.
4. Decide whether `docs/author-ux-integration-refactor-plan.md` should be removed or distilled into durable architecture/product documentation.
5. Decide whether this handoff file should be removed before merge or distilled into a permanent implementation/acceptance note. It is intentionally useful while the branch is active, but should not become stale project documentation accidentally.
6. After deleting any temporary verification/docs, run the repository’s normal final verification path again if possible and inspect the final PR diff for accidental temporary material.
7. Do not merge until the user has completed/accepted the real-device checks above.

## Files most relevant to the latest lifecycle repair

- `src/author/tasks/commitState.ts`
- `src/author/tasks/useAuthorTaskRuntime.ts`
- `src/author/tasks/types.ts`
- `src/author/ui/workspaceDefinition.tsx`
- `src/author/ui/AuthorWorkspaceRenderer.tsx`
- `src/author/persistence/authorProjectPersistence.ts`
- `src/author/workspace/AuthorWorkspaceHost.tsx`
- `src/author/resources/ReferenceField.tsx`
- `src/author/resources/completion.ts`
- `tests/authorCommitLifecycle.test.ts`
- `.github/workflows/verify-author-ux-refactor.yml`

UX cleanup touched:

- `src/features/media/author/structuredWorkspaces.tsx`
- `src/features/media/author/AssetExplorer.tsx`
- `src/author/workspace/AuthorWorkspaceHost.tsx`

Always inspect the current branch before relying on this list; it is a handoff aid, not an ownership registry.

## Safe continuation order for a fresh conversation

1. Fetch PR #182 info and read this file before making changes.
2. Compare `main...author-ux-integration-refactor`; do not assume the branch is still 0 behind.
3. Inspect the latest branch verification run; do not rely only on the historical green SHAs in this log.
4. If the user is ready for acceptance, guide/perform the manual checklist above and record results here.
5. If implementing the optional Node -> Input prerequisite-save cleanup, keep it isolated and use the existing structured Save boundary; verify again afterward.
6. Repair any new findings without weakening architecture assertions just to make CI green.
7. When acceptance is complete, remove temporary verifier/planning/handoff material as appropriate.
8. Re-run/inspect final verification and final PR diff.
9. Only then reassess merge readiness; do not merge without explicit user direction.
