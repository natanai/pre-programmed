# Author UX Integration Refactor — Current Checkpoint

Branch: `author-ux-integration-refactor`

This is the compact resume document for the current branch state. The longer historical plan remains in `docs/author-ux-integration-refactor-plan.md`.

## Current relationship to main

- Base / merge base: `02d5ac8cb77556094bf6c83c8c9721d0c8940c1c`
- Ahead of `main`: 137 commits at this checkpoint
- Behind `main`: 0
- Temporary branch-only verification workflow remains at `.github/workflows/verify-author-ux-refactor.yml`; delete it before merge.

## Completed architecture milestones

- Commands is fully structured; no Commands `renderWorkspace` remains and Commands is not a legacy Author exception.
- Project is fully off the legacy Author exception path.
- Radix runtime presentation is feature-owned; App no longer owns Radix sequence/startup/rendering internals.
- Narrative player-surface derivation, continuation presentation, interaction performances, and interaction prose provenance moved behind Narrative-owned runtime contracts. App still legitimately dispatches `executeInteraction(...)` as a composition-root call.
- `App.tsx` is net smaller than `main` despite installing these contracts (latest compare: 87 additions / 219 deletions).
- Shared Author task host owns task Back/X, focus return, clean ancestor jumps, dirty markers, and nested task continuity.
- Shared Author semantic grammar now includes `resource` and `action-row`; ordinary resource-picker custom escape hatches were removed.
- Shared structured workspace controller now supports save-without-resource-completion and exposes controller-owned `dirty` state for feature actions that need read-only dirty awareness.

## Media current state

### Structured / migrated

- Media Assets browser
- Synth Sounds library
- Synth Sound editor: real structured draft/save ownership
- File Media editor: real structured metadata draft/save ownership
- File Media help route

The old stateful `SynthPanel.tsx` and `MediaAssetEditor.tsx` are physically deleted.

### Remaining legacy Media boundary

- **Vector editor only** (`VectorAssetEditor` through Media `renderWorkspace`).

Do not remove `media` from `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` until Vector’s actual draft/content lifecycle is genuinely migrated. Vector has async SVG-content loading plus undo/redo/canvas interaction state, so do not disguise it as a giant structured `custom` block merely to reduce the exception count.

Resource routing is intentionally split:
- repository/file image or audio → structured `asset` workspace;
- vector-grid image → `vector-asset` owner directly;
- synth → structured `synth-sound` workspace.

## Synth product / UX constraint

See `docs/author-synth-interaction.md`.

The Synth is for retro computer/system chirps, bleeps, alerts and related procedural sounds—not a miniature general-purpose music workstation.

Current interaction:
- large step pads; 4 per row on narrow/mobile;
- ON/OFF directly on each pad;
- selected-step editor rather than repeated tiny note controls;
- note is a large vertical scrub surface: drag up = higher pitch, drag down = lower pitch;
- pitch scrubbing auditions semitone changes;
- visible `-12/-1/+1/+12` precision fallback plus keyboard arrows;
- waveform uses tactile buttons and auditions the selected step;
- per-step `volume` stays in data/runtime for compatibility but is intentionally hidden from normal Author UI;
- Attack/Release/Tempo/Sequence Length inherit shared Author numeric scrub/flick behavior.

## Narrative current state

- Node editor is structured.
- Story Structure is structured with a specialized graph browser.
- Runtime presentation/execution interpretation has been substantially removed from App.
- Remaining unrestricted Author renderer: **Interaction editor only**.

Interaction still legitimately owns its draft, validation, internal Response/Input Settings navigation, save registration, delete lifecycle, and task completion. Do not claim Narrative is fully structured until that ownership is actually moved rather than wrapped wholesale as `custom`.

## Verification state

Full `npm run verify` has passed after:
- structured Synth migration;
- tactile/mobile Synth redesign including vertical pitch scrub and hidden per-step volume UI;
- structured File Media migration and deletion of the old editor;
- current Media routing split leaving Vector as the only unrestricted Media editor.

## Next recommended work

1. Inspect Narrative Interaction and Vector side-by-side for the next genuine ownership migration.
2. Prefer Narrative Interaction if its draft/save lifecycle can be lifted into the structured controller without breaking internal response/settings sub-navigation.
3. Prefer Vector only after defining a deliberate pattern for async draft initialization/content loading plus undo/redo, rather than embedding the existing editor wholesale.
4. After each real legacy migration, run full branch verification and physically delete superseded code/styles.
5. Session lifecycle remains the largest untouched runtime ownership debt after Author legacy reduction.

## Manual checks still required before merge

- iPhone-size Synth: 4 step pads per row, direct ON/OFF, vertical note drag, pitch audition, waveform buttons, no visible per-step volume control.
- Synth save/reopen and existing preset compatibility.
- File Media edit/save/export/reset/delete/missing-content recovery.
- File-vs-vector image resource Edit routing.
- Nested resource create/edit return, focus restoration, dirty trail behavior.
- Narrative Interaction internal `[‹ INPUT]` navigation vs shared task Back/X.
- Player behavior, Narrative continuations, Radix startup/effects, save/load compatibility.
