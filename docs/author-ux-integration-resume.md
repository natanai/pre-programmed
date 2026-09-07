# Author UX + Integration Refactor — Resume Checkpoint

Branch: `author-ux-integration-refactor`
Updated: 2026-09-07

This file is the compact resume point for interrupted GitHub sessions. The longer history and principles remain in `docs/author-ux-integration-refactor-plan.md`.

## Current verified architecture

- Branch remains based on `main` merge-base `02d5ac8cb77556094bf6c83c8c9721d0c8940c1c` unless a later comparison says otherwise.
- Shared Author task/resource system owns task Back/X, structured draft dirty state, Save registration, nested resource return, and focus restoration.
- Commands, Media, Project, Inventory, State, World, and Radix Author workspaces no longer require unrestricted legacy rendering.
- `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` contains **Narrative only**.
- The only remaining unrestricted Author path is Narrative Interaction editing; do not remove the Narrative exception until its actual draft/validation/save lifecycle moves to the structured controller.
- `App.tsx` delegates Radix presentation/runtime state and major Narrative presentation derivation/prose interpretation to feature-owned contracts. `executeInteraction(...)` remains an intentional composition-root dispatch call.

## Media migration completed

Media has no `renderWorkspace`.

Structured tasks now own:

- Media Assets browser task shell;
- Synth library;
- Synth Sound draft/dirty/validation/persistence/resource completion;
- repository File Media metadata/save/export/reset-delete;
- Vector durable draft/save lifecycle.

The Vector structured draft owns only authored durable data:

- stable asset id;
- name;
- player presentation;
- vector-grid document.

The specialized Vector canvas owns only transient manipulation state:

- pencil / eraser / fill;
- color;
- zoom;
- resize input state;
- undo / redo;
- pointer/stroke state.

Existing vector SVG content loads asynchronously through `configuredAssetContentStore` and then calls the shared structured controller's `adoptLoadedDraft(...)`, which installs the canonical loaded draft and baseline together. Ordinary edits still use `setDraft` and remain dirty. Metadata fields are disabled during initial content loading so an early edit cannot be overwritten by the canonical SVG load.

Old `MediaAssetEditor.tsx`, `SynthPanel.tsx`, and `VectorAssetEditor.tsx` are deleted. Legacy wrapper CSS created by those editors was cleaned up. The final Media removal from the legacy exception set passed full `npm run verify`.

## Synth product direction

The Synth is primarily for short retro computer/system sounds, not a general-purpose music workstation. Keep capability, but use progressive disclosure so uncommon controls do not dominate mobile authoring.

Normal authoring hierarchy:

`SOUND PALETTE → WAVE → SHAPE → STEPS → PITCH`

Current palettes are ordinary editable Synth recipes:

- BLIP
- CHIRP
- CONFIRM
- CHIME
- ALERT
- ERROR
- BOOT
- ASCEND
- ZAP
- HIT

Current direct manipulation:

- mobile: four large step pads per row;
- ON/OFF is available directly on every step pad;
- selected-step editor has independent AUDITION;
- large note surface scrubs vertically: drag up = higher pitch, drag down = lower pitch;
- pitch changes audition while scrubbing;
- visible `-12 / -1 / +1 / +12` fallback controls and keyboard arrows remain;
- waveform is tactile SQUARE / TRI / SAW / SINE / NOISE buttons;
- lightweight envelope shapes are TIGHT / PUNCH / SOFT / RING;
- raw Attack/Release remain under `EXACT ENVELOPE` and inherit shared numeric scrub/flick;
- per-step Volume remains fully authorable but secondary: collapsed `VOLUME n%` disclosure opens a full-width 0–100 touch rail plus `-5 / +5` controls;
- no Synth persistence/schema format was added for palettes or shape controls.

See `docs/author-synth-interaction.md` for the focused interaction contract.

## Shared structured-controller additions

`AuthorWorkspaceBuildContext` now exposes:

- `dirty`: read-only core-owned dirty state;
- `saveCurrentDraft({ completeTask: false })`: prerequisite save without completing a nested resource task;
- `adoptLoadedDraft(draft)`: install asynchronously loaded canonical source data as the clean draft/baseline.

Do not use `adoptLoadedDraft` for ordinary edits; doing so would bypass dirty semantics.

## Verification

Temporary branch-only workflow:

`.github/workflows/verify-author-ux-refactor.yml`

It runs Node 22, `npm ci --no-audit --no-fund`, then full `npm run verify` on every branch push. It is temporary scaffolding and **must be deleted before merge**.

A stale GitHub Actions run once blocked newer heads, so branch-only concurrency was removed from this temporary workflow. This changes no production workflow.

Recent green checkpoints include:

- complete Synth mobile/direct-manipulation redesign and expanded palettes;
- File Media structured migration and deletion of old File editor;
- shared async `adoptLoadedDraft(...)` capability;
- standalone Vector structured workspace compilation;
- live routing of Vector through the structured workspace with legacy fallback still present;
- removal of Media `renderWorkspace`;
- removal of Media from `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS`;
- deletion of old Vector editor;
- removal of dead Vector wrapper CSS.

## Next task: Narrative Interaction

Narrative Interaction is now the last real legacy Author boundary.

Do **not** migrate it by wrapping the existing stateful `InteractionEditor` wholesale in one `custom` node. A real migration should:

1. move the canonical `Interaction` draft and shared dirty baseline to a structured workspace definition;
2. move the durable save path to that definition using the existing `interaction.upsert` mutation;
3. keep internal screen navigation (`overview`, `response`, `input-settings`) as transient specialized editor state or structured draft state excluded from the signature;
4. preserve fallback/capture normalization and all save validation;
5. preserve destination create/edit nested-owner routes;
6. preserve outcome ordering, draft/configured status, conditions, effects, authored text, conversation/speaker behavior, and Preview;
7. preserve Delete through the same Narrative mutation owner;
8. remove the old `renderWorkspace` only after the structured route passes full verification;
9. then remove Narrative from `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` and verify again.

If this migration becomes too broad for one access window, stop at a clean verified intermediate split rather than creating a cosmetic wrapper.

## After legacy Author reaches zero

- update `docs/author-ux-integration-refactor-plan.md` and `docs/author-ui-grammar.md` if needed;
- re-audit feature-specific imports/branches still in `App.tsx`;
- consider Session lifecycle consolidation as its own behavior-preserving architecture lane;
- run manual mobile + desktop Author acceptance route;
- delete `.github/workflows/verify-author-ux-refactor.yml` before merge;
- compare branch against current `main`, reconcile any incoming changes, then merge only after final full verification.
