# Author UX + Integration Refactor — Live Handoff Log

Branch: `author-ux-integration-refactor`
PR: #182 — **draft / do not merge yet**
Base: `main`

> This file is the recovery point for continuing this branch from a fresh ChatGPT conversation. Keep it current after every meaningful repair/verification pass. The PR head changes as commits are added; always re-read the actual PR head before editing.

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

The previous Commands and Synth blockers were repaired. A later branch-wide audit found two deeper shared lifecycle/persistence blockers:

- durable Author operations could remain in flight while shell navigation changed the active task;
- parent resource fields inferred deletion from optimistic snapshot disappearance, so a failed/conflicted child deletion could still mutate the suspended parent draft.

Both now have shared architectural repairs in progress. The navigation/commit lock is largely implemented. Explicit deletion completion is implemented at the shared contract layer but still needs propagation through every canonical resource delete owner.

## DONE — latest repair pass

### Shared durable-operation lock

- Added shared Author commit-in-progress state with reference counting.
- `persistAuthorMutation()` participates automatically, so durable project Save/Delete/Reset operations use the same lock rather than feature-specific navigation rules.
- Structured workspace Save holds an outer commit token through persistence **and child task completion**, preventing navigation from outrunning the typed nested result.
- `useAuthorTaskRuntime` blocks user stack-changing operations while any commit token is active.
- `completeTask()` intentionally remains allowed while locked so a successful child save/delete can still return its typed outcome to the suspended parent.
- Structured Author feature controls become inert while a durable Author write is pending.
- Added adversarial/deferred contract tests for commit lock lifetime and overlapping scopes.

### Explicit resource deletion completion

- Added task result shape `resource-deleted(kind, id)`.
- Removed `ReferenceField` behavior that cleared a selected reference merely because the resource disappeared from the current/optimistic option list.
- Added a pure resource-completion reconciler:
  - no result / cancelled / unrelated result => parent unchanged;
  - matching returned resource => parent adopts returned value;
  - matching confirmed `resource-deleted` => parent clears the reference.
- Added contract tests asserting failed/no/unrelated completion preserves the parent reference and matching accepted deletion clears it.
- Added shared `completeAuthorResourceDeletion(context, kind, id)` helper.
- Converted World Character/Location deletion to return the explicit deletion result when nested while preserving root-task completion behavior.

## TODO — merge blockers

### 1. Finish explicit deletion-result propagation everywhere

Search every canonical resource editor with a durable Delete/Reset that may be opened through `resources.edit(...)` and replace generic `leaveCurrentTask()` after accepted deletion with `completeAuthorResourceDeletion(...)` using the resource kind/value owned by that route.

Known paths to inspect/convert:

- State Group (`state-group`) — this is the concrete failed optimistic-delete reproduction from the audit.
- State Variable / Flag / Computed if they expose deletion.
- Inventory Item (`item`).
- Inventory Body Type / body background resource kind used by the manifest.
- Narrative Interaction and Node if canonical reference editing can delete them.
- Commands player-command resource if deletion is reachable via resource edit.
- Media Synth Sound (`synth-sound` and possibly union alias `media-sound` depending on route `resourceTask`).
- Media image/vector/database asset routes where deletion/reset completes a canonical resource task.
- Any other owner returned by Author resource manifests.

Important: use the route’s `resourceTask`/canonical kind where aliases exist. A `media-sound` parent that edits a Synth sound must receive deletion for the kind it actually referenced, not only `synth-sound`, or the parent will not reconcile.

After conversion, a failed/conflicted deletion must return **no deletion completion** and leave the child editor active with the parent draft unchanged.

### 2. Update temporary verification workflow

`.github/workflows/verify-author-ux-refactor.yml` still contains an assertion requiring the removed `previousSelectionRef` optimistic-disappearance behavior in `ReferenceField`.

Replace that assertion with checks for the new explicit deletion contract and/or rely on the behavioral test. The workflow must not encode the bug we intentionally removed.

### 3. Run/inspect full verification at final blocker-repair head

Required:

- architecture assertions pass;
- `npm ci --no-audit --no-fund`;
- full `npm run verify`;
- inspect failure logs and repair without weakening validators.

Do not call the branch merge-ready merely because an older head was green.

## TODO — audit UX cleanup after blockers

These are not data-safety blockers but were found in the latest audit and should be cleaned before calling the UI grammar finished:

- Synth Sounds list: use semantic `list` rows (`name` + `N voices · BPM`) instead of packing authored identity into action-row verbs; keep `+ SOUND` as the action.
- Author Tools / shell Find duplication: choose one canonical Find presentation on the Tools task. Preferred direction from audit: keep the larger Tools search on Tools and hide shell Quick Find there; keep shell Quick Find elsewhere.
- Asset Explorer copy: remove instruction requiring authors to manually add neighboring `.asset.json` sidecars. Repository scanner can assign deterministic IDs/create receipts when writable; live instruction should match actual workflow.

## TODO — creative-flow follow-up (not part of safety blocker unless kept small/isolated)

Narrative new Node -> Input currently requires an explicit prerequisite Save. Desired eventual flow: Add Input transparently performs the prerequisite Node save and then opens the Input task, using the same canonical save path and typed task semantics. Do not implement by creating an alternate persistence path.

## Verification / acceptance still required before merge

- Real iPhone/mobile acceptance with keyboard open and closed.
- Desktop acceptance including narrow/resizable Author panel.
- Nested create: parent reference -> `+ CREATE` -> child Save -> attempt Back/Tools/Find/Stack/X while pending -> no navigation; resolve -> child completes once -> parent gets resource exactly once.
- Nested delete failure/conflict: optimistic snapshot may temporarily omit resource -> parent remains unchanged -> rejection/conflict restores canonical snapshot -> child remains available for correction/retry.
- Nested delete success: accepted/queued deletion returns explicit deletion result -> parent clears exactly that reference and is marked dirty.
- Save All with nested child completion still re-reads live task stack and saves newly dirtied parent work.
- Commands dynamic placeholder/alias regressions remain green.
- Synth rapid audition uses shared AudioContext / replacement preview behavior.
- Narrative / World / Inventory / State / Radix / Media capabilities remain present.
- Player runtime behavior and existing save/project data compatibility unchanged.
- Confirm branch is 0 behind `main` before final merge decision.
- Remove temporary `.github/workflows/verify-author-ux-refactor.yml` before merge.
- Decide whether temporary `docs/author-ux-integration-refactor-plan.md` and this handoff log should be deleted or distilled into durable docs before merge.

## Files added/changed specifically by the latest blocker repair

Shared lifecycle/resource contract areas include:

- `src/author/tasks/useAuthorTaskRuntime.ts`
- `src/author/tasks/types.ts`
- `src/author/ui/workspaceDefinition.tsx`
- `src/author/ui/AuthorWorkspaceRenderer.tsx`
- `src/author/persistence/authorProjectPersistence.ts`
- `src/author/resources/ReferenceField.tsx`
- `src/author/resources/completion.ts`
- shared commit-state module added during this repair
- adversarial Author lifecycle/resource completion tests added during this repair
- `src/features/world/author/entityWorkspaces.tsx` converted to explicit deletion completion

Always inspect the current branch before relying on this list; it is a handoff aid, not an ownership registry.

## Safe continuation order

1. Re-read PR #182 head and this file.
2. Inspect Author resource manifests to enumerate every canonical resource kind + edit route.
3. Inspect each owner’s accepted Delete/Reset path.
4. Convert all nested canonical deletions to `completeAuthorResourceDeletion` with the route’s referenced kind.
5. Update the temporary verifier so it asserts the new contract rather than `previousSelectionRef`.
6. Run the full branch workflow / inspect logs.
7. Repair any failures without weakening architectural validation.
8. Do the three small UX cleanup items.
9. Full verification again.
10. Update this handoff log with exact results and remaining manual acceptance.
11. Do not merge until the final acceptance checklist and branch-behind-main check are complete.
